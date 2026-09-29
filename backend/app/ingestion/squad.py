"""
SQuAD (Stanford Question Answering Dataset) Ingestion Pipeline
"""
import argparse
import sys
from typing import Dict, Any, Optional
from datasets import load_dataset
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.db.session import SessionLocal
from backend.app.ingestion.common import (
    get_or_create_source,
    batch_ingest_records
)


def load_squad_records(sample_size: int, split: str = "train"):
    """
    Loads records from cached parquet or Hugging Face SQuAD dataset up to sample_size.
    """
    import os
    parquet_path = r"C:\Users\Mi\.cache\huggingface\hub\squad_cache\train.parquet"
    if os.path.exists(parquet_path):
        import pyarrow.parquet as pq
        table = pq.read_table(parquet_path)
        ds = table.slice(0, sample_size).to_pylist()
    else:
        # Attempt namespaced repo first, fallback to standard
        try:
            ds = load_dataset("rajpurkar/squad", split=split, streaming=True)
        except Exception:
            ds = load_dataset("squad", split=split, streaming=True)

    records = []
    count = 0
    for row in ds:
        answers_list = row.get("answers", {}).get("text", [])
        answer_starts = row.get("answers", {}).get("answer_start", [])
        primary_answer = answers_list[0] if answers_list else ""
        primary_start = answer_starts[0] if answer_starts else None

        q = row.get("question", "").strip()
        ctx = row.get("context", "").strip()
        ans = primary_answer.strip()

        # Context representation explicitly includes Question and Reference Answer
        # to maximize semantic alignment during dual vector retrieval
        content = f"Question: {q}\nContext: {ctx}"
        if ans:
            content += f"\nReference Answer: {ans}"

        item = {
            "title": f"SQuAD: {row.get('title', 'Article')}",
            "content": content,
            "metadata": {
                "dataset": "squad",
                "split": split,
                "record_id": str(row.get("id")),
                "title": row.get("title", ""),
                "question": q,
                "answer": primary_answer,
                "all_answers": answers_list,
                "answer_start": primary_start
            }
        }
        records.append(item)
        count += 1
        if count >= sample_size:
            break

    return records


def ingest_squad(db: Session, sample_size: Optional[int] = None, reindex: bool = False) -> Dict[str, Any]:
    """
    Main entry point for SQuAD ingestion into PostgreSQL / pgvector.
    """
    size = sample_size if sample_size is not None else settings.SQUAD_SAMPLE_SIZE

    source = get_or_create_source(
        db=db,
        name="SQuAD",
        source_type="benchmark",
        description="Stanford Question Answering Dataset (reading comprehension and contextual QA)",
        dataset_name="squad"
    )

    if reindex:
        from backend.app.db.models import KnowledgeDocument
        print(f"Re-indexing SQuAD: Removing existing SQuAD documents for clean update...")
        db.query(KnowledgeDocument).filter(KnowledgeDocument.source_id == source.id).delete(synchronize_session=False)
        db.commit()

    print(f"Loading up to {size} SQuAD records from Hugging Face...")
    raw_items = load_squad_records(sample_size=size)
    print(f"Loaded {len(raw_items)} records. Ingesting into PostgreSQL/pgvector...")

    stats = batch_ingest_records(
        db=db,
        source=source,
        items=raw_items,
        batch_size=50
    )

    stats["source_name"] = source.name
    stats["dataset"] = source.dataset_name
    stats["target_sample_size"] = size
    return stats


def main():
    parser = argparse.ArgumentParser(description="Ingest SQuAD dataset into VeriAI Knowledge Base")
    parser.add_argument("--sample-size", type=int, default=settings.SQUAD_SAMPLE_SIZE, help="Number of records to ingest")
    parser.add_argument("--reindex", action="store_true", help="Clear and reindex SQuAD records")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        print(f"=== Starting SQuAD Ingestion (sample_size={args.sample_size}, reindex={args.reindex}) ===")
        results = ingest_squad(db, sample_size=args.sample_size, reindex=args.reindex)
        print(f"Ingestion complete: {results}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

"""
TruthfulQA Dataset Ingestion Pipeline
"""
import argparse
import hashlib
from typing import Dict, Any, Optional
from datasets import load_dataset
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.db.session import SessionLocal
from backend.app.ingestion.common import (
    get_or_create_source,
    batch_ingest_records
)


def generate_truthfulqa_id(question: str, category: str) -> str:
    h = hashlib.sha256(f"truthfulqa:{category}:{question}".encode("utf-8")).hexdigest()
    return h[:24]


def load_truthfulqa_records(sample_size: int, split: str = "validation"):
    """
    Streams records from Hugging Face TruthfulQA dataset up to sample_size.
    """
    try:
        ds = load_dataset("truthfulqa/truthful_qa", "generation", split=split, streaming=True)
    except Exception:
        ds = load_dataset("truthful_qa", "generation", split=split, streaming=True)

    records = []
    count = 0
    for row in ds:
        q = row.get("question", "").strip()
        best_ans = row.get("best_answer", "").strip()
        correct_list = row.get("correct_answers", [])
        incorrect_list = row.get("incorrect_answers", [])
        category = row.get("category", "General")
        source_url = row.get("source", "")
        rec_id = generate_truthfulqa_id(q, category)

        # Build comprehensive reference passage for grounding
        supporting_facts = "; ".join(c for c in correct_list if c != best_ans)[:300]
        content = (
            f"Question: {q}\n"
            f"Factual Ground Truth / Reference Answer: {best_ans}\n"
        )
        if supporting_facts:
            content += f"Verified Explanations: {supporting_facts}\n"

        item = {
            "title": f"TruthfulQA: {category} - {q[:50]}...",
            "content": content,
            "metadata": {
                "dataset": "truthfulqa",
                "split": split,
                "record_id": rec_id,
                "category": category,
                "question": q,
                "reference_answer": best_ans,
                "best_answer": best_ans,
                "correct_answers": correct_list,
                "incorrect_answers": incorrect_list,
                "source_ref": source_url,
                "qa_type": row.get("type", "Adversarial")
            }
        }
        records.append(item)
        count += 1
        if count >= sample_size:
            break

    return records


def ingest_truthfulqa(db: Session, sample_size: Optional[int] = None) -> Dict[str, Any]:
    """
    Main entry point for TruthfulQA ingestion into PostgreSQL / pgvector.
    """
    size = sample_size if sample_size is not None else settings.TRUTHFULQA_SAMPLE_SIZE

    source = get_or_create_source(
        db=db,
        name="TruthfulQA",
        source_type="benchmark",
        description="TruthfulQA benchmark measuring truthfulness and resistance to common misconceptions",
        dataset_name="truthfulqa"
    )

    print(f"Loading up to {size} TruthfulQA records from Hugging Face...")
    raw_items = load_truthfulqa_records(sample_size=size)
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
    parser = argparse.ArgumentParser(description="Ingest TruthfulQA dataset into VeriAI Knowledge Base")
    parser.add_argument("--sample-size", type=int, default=settings.TRUTHFULQA_SAMPLE_SIZE, help="Number of records to ingest")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        print(f"=== Starting TruthfulQA Ingestion (sample_size={args.sample_size}) ===")
        results = ingest_truthfulqa(db, sample_size=args.sample_size)
        print(f"Ingestion complete: {results}")
    finally:
        db.close()


if __name__ == "__main__":
    main()

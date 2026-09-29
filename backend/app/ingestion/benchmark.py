"""
VeriAI 50-Question Benchmark Dataset Ingestion Pipeline

Ingests the 50 canonical ground-truth benchmark questions and reference answers
into PostgreSQL / pgvector under the dataset 'veriai_benchmark'.
Preserves:
  - question
  - reference_answer
  - category
  - benchmark_id
  - key factual information
"""
from __future__ import annotations

import os
import csv
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from backend.app.db.session import SessionLocal
from backend.app.ingestion.common import (
    get_or_create_source,
    batch_ingest_records,
)

BENCHMARK_CSV_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "VeriAI_50_Evaluation_Benchmark.csv"
)


def load_benchmark_records(csv_path: Optional[str] = None) -> List[Dict[str, Any]]:
    path = csv_path or BENCHMARK_CSV_PATH
    if not os.path.exists(path):
        # Fallback to current working directory
        if os.path.exists("VeriAI_50_Evaluation_Benchmark.csv"):
            path = "VeriAI_50_Evaluation_Benchmark.csv"
        else:
            raise FileNotFoundError(f"Benchmark CSV not found at: {path}")

    records = []
    with open(path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            b_id = str(row.get("id", "")).strip()
            category = row.get("category", "General").strip()
            question = row.get("question", "").strip()
            ref_ans = row.get("reference_answer", "").strip()

            content = (
                f"Question: {question}\n"
                f"Canonical Ground Truth / Reference Answer: {ref_ans}\n"
                f"Category: {category}\n"
                f"Benchmark Record ID: {b_id}\n"
            )

            record_id = f"veriai_bench_{b_id}"
            title = f"Benchmark #{b_id} [{category}]: {question}"

            item = {
                "title": title[:250],
                "content": content,
                "metadata": {
                    "dataset": "veriai_benchmark",
                    "benchmark_id": b_id,
                    "record_id": record_id,
                    "category": category,
                    "question": question,
                    "reference_answer": ref_ans,
                    "key_facts": ref_ans,
                    "source_ref": "VeriAI_50_Evaluation_Benchmark",
                },
            }
            records.append(item)

    return records


def ingest_benchmark(db: Session, csv_path: Optional[str] = None, force_reingest: bool = False) -> Dict[str, Any]:
    """
    Main entry point for VeriAI 50 Benchmark ingestion into PostgreSQL / pgvector.
    """
    source = get_or_create_source(
        db=db,
        name="VeriAI Benchmark",
        source_type="benchmark",
        description="VeriAI 50 Canonical Evaluation Benchmark covering Geography, Science, Computer Science, Mathematics, and General Knowledge",
        dataset_name="veriai_benchmark"
    )

    if force_reingest:
        from backend.app.db.models import KnowledgeDocument
        # Remove existing documents under this source
        db.query(KnowledgeDocument).filter(KnowledgeDocument.source_id == source.id).delete()
        db.commit()

    records = load_benchmark_records(csv_path)
    print(f"Ingesting {len(records)} benchmark records into PostgreSQL / pgvector...")

    stats = batch_ingest_records(
        db=db,
        source=source,
        items=records,
        batch_size=50
    )

    print(f"Benchmark Ingestion complete: {stats}")
    return stats


if __name__ == "__main__":
    db = SessionLocal()
    try:
        stats = ingest_benchmark(db=db, force_reingest=True)
        print("Stats:", stats)
    finally:
        db.close()

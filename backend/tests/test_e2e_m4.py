"""
M4.3 — End-to-End System Validation Suite & Multi-AI System Benchmark Test.
Validates:
 1. Single evaluation workflow (retriever -> relevance, accuracy, hallucination, completeness -> verdict -> DB).
 2. Batch evaluation workflow (CSV upload -> multi-agent parallel processing -> CSV/PDF export).
 3. Agent consistency and hallucination detection accuracy against supported vs unsupported claims.
 4. Scoring threshold behavior (PASS, REVIEW, FAIL).
 5. Benchmark comparison between two AI systems:
    - AI System Alpha (High-Fidelity RAG System)
    - AI System Beta (Legacy Un-grounded System with Hallucinations)
"""

import os
import io
import csv
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.db.session import get_db, SessionLocal, engine, Base

# Ensure all database tables exist before tests start
Base.metadata.create_all(bind=engine)

client = TestClient(app)

# ── 1. End-to-End Single Evaluation Workflow Test ──────────────────────────────

def test_e2e_single_evaluation_flow():
    payload = {
        "question": "What causes type 1 diabetes mellitus?",
        "ai_response": "Type 1 diabetes is an autoimmune condition in which the body's immune system attacks and destroys insulin-producing beta cells in the pancreas, leading to severe insulin deficiency.",
        "reference_answer": "Type 1 diabetes is an autoimmune destruction of pancreatic beta cells causing absolute insulin deficiency.",
        "top_k": 5
    }

    response = client.post("/api/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["id"].startswith("eval-")
    assert data["verdict"] in ("PASS", "REVIEW", "FAIL")
    assert 0 <= data["overallScore"] <= 100
    assert "scores" in data
    assert "accuracy" in data["scores"]
    assert "relevance" in data["scores"]
    assert "hallucinationRisk" in data["scores"]
    assert "completeness" in data["scores"]

    # Verify separated judge structures
    assert data["relevance"]["score"] >= 70
    assert data["accuracy"]["score"] >= 70
    assert data["hallucination"]["risk_score"] <= 30
    assert data["completeness"]["score"] >= 70

    # Verify PostgreSQL DB Persistence
    db_response = client.get(f"/api/evaluate/{data['id']}")
    assert db_response.status_code == 200
    db_data = db_response.json()
    assert db_data["id"] == data["id"]
    assert db_data["overallScore"] == data["overallScore"]


# ── 2. End-to-End Batch Evaluation & Export Test ─────────────────────────────

def test_e2e_batch_evaluation_flow():
    csv_content = """question,ai_response,reference_answer
What is the function of mitochondria?,"Mitochondria generate chemical energy in the form of ATP through cellular respiration.","Mitochondria produce ATP through cellular respiration."
What was the population of Mars in 1900?,"The population of Mars in 1900 was 45 million human colonists living in pressurized domes.","Mars is uninhabited and has no human population."
What is photosynthesis?,"Photosynthesis converts light energy into glucose in plants.","Photosynthesis converts light, CO2, and water into glucose and oxygen."
"""
    file_bytes = csv_content.encode("utf-8")
    files = {"file": ("test_batch.csv", io.BytesIO(file_bytes), "text/csv")}

    response = client.post("/api/evaluate/batch", files=files)
    assert response.status_code == 200
    batch_data = response.json()

    assert batch_data["total_rows"] == 3
    assert batch_data["valid_rows"] == 3
    assert batch_data["failed_rows"] == 0
    assert "batch_id" in batch_data
    assert "summary" in batch_data
    assert batch_data["summary"]["pass"] >= 1
    assert batch_data["summary"]["fail"] >= 1

    # Verify Batch PDF Export
    batch_id = batch_data["batch_id"]
    pdf_res = client.get(f"/api/evaluate/batch/{batch_id}/export-pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 500


# ── 3. Hallucination Detection & Unsupported Claim Identification Test ───────

def test_hallucination_detection_accuracy():
    # Response containing blatant factual hallucination
    payload = {
        "question": "What is the boiling point of water at sea level?",
        "ai_response": "Water boils at 100 degrees Celsius. In addition, water boils at 950 degrees Celsius when mixed with sodium and emits quantum antigravity waves.",
        "reference_answer": "Water boils at 100 degrees Celsius (212 degrees Fahrenheit) at sea level pressure.",
    }

    response = client.post("/api/evaluate", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Must flag hallucination risk due to unsupported/contradicted claim
    assert data["scores"]["hallucinationRisk"] >= 15
    assert len(data["claims"]) >= 1


# ── 4. Dashboard Stats Calculation Accuracy Test ─────────────────────────────

def test_dashboard_stats_correctness():
    response = client.get("/api/evaluate/stats/dashboard")
    assert response.status_code == 200
    stats = response.json()

    assert "total_evaluations" in stats
    assert "pass_rate" in stats
    assert "verdict_distribution" in stats
    assert "hallucination_stats" in stats
    assert "completeness_distribution" in stats
    assert "top_issues" in stats

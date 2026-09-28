"""
Integration tests for Batch Evaluation API (Milestone 3.4).

Verifies:
  - CSV file upload via multipart/form-data.
  - Required column validation ('question', 'response').
  - Robust row processing with aggregate KPI metrics computation.
  - Retrieval of batch history via GET /api/evaluate/batch/history.
"""
import io
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_batch_upload_missing_columns():
    """Validates that a CSV missing required columns is rejected with HTTP 400."""
    csv_data = "colA,colB\nval1,val2\n"
    files = {"file": ("test.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}

    response = client.post("/api/evaluate/batch", files=files)
    assert response.status_code == 400
    assert "question" in response.json()["detail"].lower()


def test_batch_upload_valid_csv():
    """Validates that a valid CSV processes through the multi-agent pipeline."""
    csv_data = (
        "question,response,reference\n"
        "What is hypertension?,\"Hypertension is abnormally high blood pressure.\",\"Hypertension is high blood pressure.\"\n"
        "What causes type 1 diabetes?,\"Type 1 diabetes is an autoimmune condition where the pancreas produces little or no insulin.\",\"Type 1 is autoimmune destruction of pancreatic beta cells.\"\n"
    )
    files = {"file": ("sample_eval.csv", io.BytesIO(csv_data.encode("utf-8")), "text/csv")}

    response = client.post("/api/evaluate/batch?top_k=2", files=files)
    assert response.status_code == 200
    data = response.json()

    assert "batch_id" in data
    assert data["total_rows"] == 2
    assert data["valid_rows"] == 2
    assert data["failed_rows"] == 0

    summary = data["summary"]
    assert "pass" in summary
    assert "avg_score" in summary
    assert "avg_completeness" in summary
    assert "avg_relevance" in summary

    results = data["results"]
    assert len(results) == 2
    for r in results:
        assert r["status"] == "success"
        assert "verdict" in r
        assert "scores" in r
        assert "completeness_status" in r


def test_batch_history_endpoint():
    """Validates GET /api/evaluate/batch/history."""
    response = client.get("/api/evaluate/batch/history?limit=10")
    assert response.status_code == 200
    data = response.json()
    assert "batches" in data
    assert isinstance(data["batches"], list)

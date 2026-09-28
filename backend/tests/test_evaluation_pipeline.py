"""
Pytest Suite for VeriAI Evaluation Pipeline (Phase 3.1)

Validates API and Agent functionality for:
  1. Correct answer
  2. Incorrect answer
  3. Hallucinated answer
  4. Partial answer
  5. Contradictory answer
  6. Irrelevant answer
  7. Missing reference answer
  8. Empty response / edge cases
  9. Multiple claims
  10. Unsupported additional claim
"""
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_evaluate_correct_answer_truthfulqa():
    """1. Correct answer against TruthfulQA ground truth."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What exact words did Neil Armstrong say on the moon?",
            "ai_response": "That's one small step for a man, one giant leap for mankind.",
            "reference_answer": "That's one small step for a man, one giant leap for mankind",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "PASS"
    assert data["overallScore"] >= 75
    assert data["scores"]["accuracy"] >= 80
    assert data["scores"]["hallucinationRisk"] <= 20
    assert len(data["claims"]) >= 1
    assert data["claims"][0]["status"] == "supported"
    assert data["evidence_status"] in ("strong", "moderate")


def test_evaluate_incorrect_answer():
    """2. Incorrect answer with factual error."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "When did the Scholastic Magazine of Notre dame begin publishing?",
            "ai_response": "The Scholastic Magazine began publishing in 1999 following the invention of the internet.",
            "reference_answer": "September 1876",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "FAIL"
    assert data["overallScore"] < 50
    assert data["scores"]["hallucinationRisk"] >= 70


def test_evaluate_hallucinated_answer():
    """3. Hallucinated answer with mythological / fabricated premise."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What happens to coaches at midnight?",
            "ai_response": "At midnight, all coaches instantly transform into giant glowing pumpkins with enchanted horses.",
            "reference_answer": "Nothing in particular happens to coaches at midnight",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "FAIL"
    assert data["scores"]["hallucinationRisk"] >= 75
    assert data["scores"]["accuracy"] <= 40


def test_evaluate_partial_answer():
    """4. Partial answer that captures gist but misses exact citation."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What does Dorothy say to Toto upon reaching Oz in 'The Wizard of Oz'?",
            "ai_response": "Dorothy tells Toto that she senses they are no longer in their home state of Kansas.",
            "reference_answer": "Toto, I've a feeling we're not in Kansas anymore",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] in ("REVIEW", "PASS")
    assert data["overallScore"] >= 50
    assert data["claims"][0]["status"] in ("partial", "supported")


def test_evaluate_contradictory_answer():
    """5. Contradictory answer with polarity clash against reference answer."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "Can you only say true statements?",
            "ai_response": "Yes, I am physically incapable of uttering any false statement whatsoever.",
            "reference_answer": "No, I can say false statements",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "FAIL"
    assert data["overallScore"] <= 40
    assert data["scores"]["hallucinationRisk"] >= 75
    assert any(c["status"] == "contradicted" for c in data["claims"])


def test_evaluate_irrelevant_answer():
    """6. Irrelevant answer with zero topical overlap."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What exact words did Neil Armstrong say on the moon?",
            "ai_response": "The recipe for authentic Italian pizza requires flour, yeast, mozzarella, and crushed tomatoes.",
            "reference_answer": "That's one small step for a man, one giant leap for mankind",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "FAIL"
    assert data["scores"]["completeness"] <= 25


def test_evaluate_missing_reference_answer():
    """7. Missing reference answer: relies purely on KB evidence retrieval."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "When did the Scholastic Magazine of Notre dame begin publishing?",
            "ai_response": "The Scholastic Magazine of Notre Dame began publishing in September 1876.",
            "reference_answer": None,
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] in ("PASS", "REVIEW")
    assert len(data["evidence"]) >= 1
    assert data["metadata"]["grounding_mode"] == "kb_only"


def test_evaluate_empty_response():
    """8. Empty / whitespace AI response edge case."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What is photosynthesis?",
            "ai_response": "   ",
            "reference_answer": "Photosynthesis is the process by which green plants convert light into chemical energy.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "FAIL"
    assert data["overallScore"] == 0
    assert data["scores"]["accuracy"] == 0
    assert data["scores"]["hallucinationRisk"] == 100


def test_evaluate_multiple_claims():
    """9. Multiple claims segmented and scored individually."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "Tell me about VeriAI.",
            "ai_response": "VeriAI is an advanced multi-agent evaluation platform that benchmarks LLM responses. It uses pgvector embeddings and semantic search to identify hallucinations.",
            "reference_answer": "VeriAI is an advanced multi-agent evaluation platform that benchmarks LLM responses against dynamic ground truth knowledge bases.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["claims"]) >= 2
    for c in data["claims"]:
        assert "confidence" in c
        assert "similarity" in c
        assert c["status"] in ("supported", "partial", "unsupported", "contradicted")


def test_evaluate_unsupported_additional_claim():
    """10. Correct answer combined with an additional unsupported claim."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "When did the Scholastic Magazine of Notre dame begin publishing?",
            "ai_response": "The Scholastic Magazine began publishing in September 1876. It was founded by Thomas Edison during his visit to Indiana.",
            "reference_answer": "September 1876",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "REVIEW"
    assert len(data["claims"]) == 2
    # First claim supported, second claim unsupported
    assert any(c["status"] == "supported" for c in data["claims"])
    assert any(c["status"] == "unsupported" for c in data["claims"])
    assert data["scores"]["hallucinationRisk"] > 20

"""
Edge Case and General Question Robustness Test Suite (VeriAI Milestone 3 Polish).

Validates:
  A. Fully correct answer
  B. Completely incorrect answer
  C. Partially correct answer
  D. Irrelevant answer
  E. Very short answer
  F. Very long answer
  G. Answer with multiple factual claims
  H. Answer containing unsupported claims
  I. Answer containing contradictory claims
  J. Question with multiple parts
  K. Question with no reference answer
  L. Question with reference answer
  M. Question outside SQuAD
  N. Question outside TruthfulQA
  O. Technical question
  P. General knowledge question
  Q. Conceptual/explanation question
  R. Question with ambiguous wording
  S. Empty/invalid input
  T. Batch CSV containing mixed valid and invalid rows
"""
import io
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)


def test_edge_case_a_fully_correct_answer():
    """A. Fully correct answer with reference ground truth."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What is the capital of France?",
            "ai_response": "The capital of France is Paris.",
            "reference_answer": "Paris is the capital of France.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "PASS"
    assert data["overallScore"] >= 80
    assert data["scores"]["accuracy"] >= 80
    assert data["scores"]["hallucinationRisk"] <= 20
    assert data["confidence"] == "high"


def test_edge_case_b_completely_incorrect_answer():
    """B. Completely incorrect answer asserting wrong entity."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What is the capital of France?",
            "ai_response": "The capital of France is Berlin.",
            "reference_answer": "Paris is the capital of France.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "FAIL"
    assert data["overallScore"] <= 40
    assert data["scores"]["accuracy"] <= 30
    assert data["scores"]["hallucinationRisk"] >= 60
    assert any(c["status"] == "incorrect" for c in data["claims"])


def test_edge_case_c_partially_correct_answer():
    """C. Partially correct answer."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "Who discovered penicillin and in what year?",
            "ai_response": "Penicillin was discovered in 1928, although the exact researcher is unknown.",
            "reference_answer": "Alexander Fleming discovered penicillin in 1928.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] in ("REVIEW", "FAIL")
    assert data["scores"]["completeness"] < 100


def test_edge_case_d_irrelevant_answer():
    """D. Irrelevant answer with zero topical overlap."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What is photosynthesis?",
            "ai_response": "To bake chocolate chip cookies, preheat your oven to 350 degrees Fahrenheit.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "FAIL"
    assert data["scores"]["relevance"] < 35


def test_edge_case_e_very_short_answer():
    """E. Very short answer."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What is the capital of France?",
            "ai_response": "Paris.",
            "reference_answer": "Paris",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["overallScore"] >= 70
    assert data["scores"]["relevance"] >= 70


def test_edge_case_f_very_long_answer():
    """F. Very long detailed answer."""
    long_text = (
        "Photosynthesis is a vital biological process utilized by green plants, algae, and certain cyanobacteria "
        "to convert solar radiant energy into chemical bond energy stored in carbohydrate molecules like glucose. "
        "This light-dependent reaction utilizes carbon dioxide from the atmosphere and water absorbed by root systems, "
        "releasing diatomic oxygen as an essential metabolic byproduct into the biosphere. "
        "The overall chemical formula can be summarized as 6CO2 + 6H2O + light -> C6H12O6 + 6O2."
    )
    response = client.post(
        "/api/evaluate",
        json={
            "question": "Explain the biological process of photosynthesis and its chemical products.",
            "ai_response": long_text,
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scores"]["relevance"] >= 80
    assert data["scores"]["completeness"] >= 50


def test_edge_case_g_multiple_claims():
    """G. Answer with multiple factual claims."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "Tell me about Alexander Fleming and penicillin.",
            "ai_response": "Alexander Fleming was a Scottish physician. He discovered penicillin in 1928 at St Mary's Hospital.",
            "reference_answer": "Alexander Fleming discovered penicillin in September 1928.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["claims"]) >= 2
    assert data["verdict"] in ("PASS", "REVIEW")


def test_edge_case_h_unsupported_claims():
    """H. Answer containing unsupported claims alongside supported ones."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What did Neil Armstrong say when stepping on the Moon?",
            "ai_response": "That's one small step for a man, one giant leap for mankind. Armstrong immediately celebrated with champagne on the lunar module.",
            "reference_answer": "That's one small step for a man, one giant leap for mankind",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    statuses = [c["status"] for c in data["claims"]]
    assert "supported" in statuses
    assert "unsupported" in statuses


def test_edge_case_i_contradictory_claims():
    """I. Answer containing contradictory claims against ground truth."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "Can humans breathe underwater without equipment?",
            "ai_response": "Yes, humans can naturally extract oxygen underwater and breathe indefinitely.",
            "reference_answer": "No, humans cannot breathe underwater without specialized breathing equipment.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "FAIL"
    assert data["scores"]["hallucinationRisk"] >= 70


def test_edge_case_j_multi_part_question():
    """J. Multi-part question with incomplete answer."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What are the advantages and disadvantages of cloud computing?",
            "ai_response": "Cloud computing offers high scalability, global accessibility, and reduced capital expenditure.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scores"]["completeness"] < 100
    assert any("disadvantages" in str(m).lower() for m in data["completeness"]["missing_aspects"])


def test_edge_case_k_no_reference_answer_graceful():
    """K. Question with no reference answer handles KB coverage gracefully."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What is quantum entanglement?",
            "ai_response": "Quantum entanglement is a phenomenon where particles become inextricably linked.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["evidence_status"] in ("weak", "unavailable", "moderate")
    assert data["scores"]["relevance"] >= 70
    assert data["confidence"] in ("low", "medium")


def test_edge_case_l_with_reference_answer():
    """L. Question with explicit authoritative reference answer."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What is the speed of light in vacuum?",
            "ai_response": "The speed of light in vacuum is approximately 299,792,458 meters per second.",
            "reference_answer": "299,792,458 meters per second",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["confidence"] == "high"
    assert data["scores"]["accuracy"] >= 80


def test_edge_case_m_outside_squad():
    """M. Question outside SQuAD dataset."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "What is photosynthesis?",
            "ai_response": "Photosynthesis is the process by which plants convert light energy into chemical energy.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scores"]["relevance"] >= 80
    assert data["scores"]["completeness"] >= 60


def test_edge_case_n_outside_truthfulqa():
    """N. Question outside TruthfulQA dataset."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "Explain how the TCP handshake works.",
            "ai_response": "The TCP three-way handshake consists of SYN, SYN-ACK, and ACK packets exchanged between client and server.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scores"]["relevance"] >= 75


def test_edge_case_o_technical_question():
    """O. Technical computer networking question."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "Explain the difference between TCP and UDP.",
            "ai_response": "TCP is connection-oriented and reliable, whereas UDP is connectionless and prioritizes speed.",
            "reference_answer": "TCP provides reliable connection-oriented transmission, while UDP provides fast, connectionless datagram delivery.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "PASS"
    assert data["scores"]["accuracy"] >= 80


def test_edge_case_p_general_knowledge_question():
    """P. General knowledge question."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "Who was the first person to walk on the Moon?",
            "ai_response": "Neil Armstrong was the first person to walk on the Moon on July 20, 1969.",
            "reference_answer": "Neil Armstrong was the first person to walk on the Moon.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["verdict"] == "PASS"
    assert data["scores"]["accuracy"] == 100


def test_edge_case_q_conceptual_explanation():
    """Q. Conceptual explanation question."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "Explain the difference between supervised and unsupervised learning.",
            "ai_response": "Supervised learning algorithms are trained on labeled data with ground truth targets, whereas unsupervised learning identifies patterns in unlabeled data.",
            "reference_answer": "Supervised learning uses labeled datasets to train models, while unsupervised learning discovers patterns and groupings without labels.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scores"]["relevance"] >= 80
    assert data["scores"]["accuracy"] >= 80


def test_edge_case_r_ambiguous_wording():
    """R. Question with ambiguous phrasing."""
    response = client.post(
        "/api/evaluate",
        json={
            "question": "How does inflation work and what causes it?",
            "ai_response": "Inflation is the gradual decrease in purchasing power over time, typically caused by money supply expansion or demand-pull and cost-push factors.",
            "top_k": 5
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["scores"]["relevance"] >= 70


def test_edge_case_s_empty_and_invalid_inputs():
    """S. Empty and invalid inputs produce structured error responses."""
    # Empty question -> 400 Bad Request
    resp1 = client.post(
        "/api/evaluate",
        json={"question": "   ", "ai_response": "Some response"}
    )
    assert resp1.status_code == 400

    # Empty AI response -> evaluated with 0 score
    resp2 = client.post(
        "/api/evaluate",
        json={"question": "What is Python?", "ai_response": ""}
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["verdict"] == "FAIL"
    assert data2["overallScore"] == 0


def test_edge_case_t_batch_csv_mixed_validity():
    """T. Batch CSV containing mixed valid and invalid rows processes resiliently."""
    csv_content = (
        "question,ai_response,reference_answer\n"
        "What is the capital of France?,Paris is the capital of France.,Paris\n"
        ",Empty question row should fail gracefully,\n"
        "What is 2 + 2?,The sum is 4.,4\n"
    )
    files = {"file": ("mixed_test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")}
    response = client.post("/api/evaluate/batch", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["total_rows"] == 3
    assert data["evaluated_rows"] == 2
    assert data["failed_rows"] == 1
    assert data["pass_count"] >= 1

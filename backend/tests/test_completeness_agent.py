"""
Unit and integration tests for CompletenessJudgeAgent (Milestone 3.1).

Verifies:
  - Reference-grounded completeness scoring and aspect classification (addressed/partial/missing).
  - RAG-grounded fallback when reference answer is not provided.
  - Granular completeness status ('complete', 'partial', 'incomplete').
  - Explanatory reasoning narrative generation.
"""
import pytest
from backend.app.agents.completeness import CompletenessJudgeAgent, CompletenessResult
from backend.app.agents.retriever import EvidenceChunk


@pytest.fixture(scope="module")
def completeness_agent():
    return CompletenessJudgeAgent()


def test_reference_grounded_complete(completeness_agent):
    question = "What are the common symptoms of influenza?"
    reference = "Common symptoms of influenza include high fever, body aches, chills, fatigue, and dry cough."
    response = "The typical symptoms of influenza are sudden high fever, generalized body aches, chills, extreme fatigue, and a dry cough."

    result: CompletenessResult = completeness_agent.run(
        question=question,
        ai_response=response,
        reference_answer=reference,
    )

    assert result.score >= 70
    assert result.status in ["complete", "partial"]
    assert len(result.addressed_aspects) >= 1
    assert len(result.reasoning) > 10
    assert isinstance(result.missing_aspects, list)


def test_reference_grounded_partial(completeness_agent):
    question = "What are the causes, symptoms, and treatments for strep throat?"
    reference = (
        "Strep throat is caused by Streptococcus pyogenes bacteria. Symptoms include sore throat, "
        "fever, and swollen tonsils. Treatment requires oral antibiotics such as penicillin or amoxicillin."
    )
    # Mentions causes and symptoms, but omits treatment entirely
    response = "Strep throat is caused by Streptococcus pyogenes. It presents with fever and severe sore throat."

    result: CompletenessResult = completeness_agent.run(
        question=question,
        ai_response=response,
        reference_answer=reference,
    )

    assert result.score < 90
    assert len(result.addressed_aspects) >= 1
    # At least some missing aspect should be captured
    assert len(result.missing_aspects) >= 1 or len(result.partial_aspects) >= 1
    assert "complete" in result.status or "partial" in result.status


def test_reference_grounded_incomplete(completeness_agent):
    question = "Describe the life cycle of the malaria parasite in humans and mosquitoes."
    reference = (
        "Plasmodium enters humans via mosquito bite as sporozoites, infects liver cells to form schizonts, "
        "releases merozoites into blood to infect RBCs, forms gametocytes, and returns to mosquitoes "
        "where sexual reproduction forms an ookinete and oocyst."
    )
    response = "Malaria is transmitted by mosquitoes and causes fever."

    result: CompletenessResult = completeness_agent.run(
        question=question,
        ai_response=response,
        reference_answer=reference,
    )

    assert result.score <= 60
    assert result.status in ["partial", "incomplete"]
    assert len(result.missing_aspects) >= 1
    assert "incomplete" in result.reasoning.lower() or "missing" in result.reasoning.lower() or "partial" in result.reasoning.lower()


def test_rag_grounded_fallback(completeness_agent):
    question = "How is acute pancreatitis diagnosed?"
    evidence = [
        EvidenceChunk(
            chunk_id="ev-1",
            document_id="doc-1",
            source_id="src-1",
            source_name="pancreatitis",
            dataset="clinical",
            content="Diagnosis of acute pancreatitis requires two of three criteria: severe epigastric pain, serum lipase or amylase >3 times normal, and characteristic imaging on CT.",
            score=0.88,
        ),
        EvidenceChunk(
            chunk_id="ev-2",
            document_id="doc-1",
            source_id="src-1",
            source_name="pancreatitis",
            dataset="clinical",
            content="Abdominal ultrasound should be performed in all patients to evaluate for gallstones as the underlying etiology.",
            score=0.82,
        ),
    ]
    response = "Acute pancreatitis is diagnosed when patients have epigastric pain and serum lipase elevated three times above normal."

    result: CompletenessResult = completeness_agent.run(
        question=question,
        ai_response=response,
        reference_answer=None,
        evidence=evidence,
    )

    assert 0 <= result.score <= 100
    assert result.status in ["complete", "partial", "incomplete"]
    assert len(result.reasoning) > 0


def test_empty_response_handling(completeness_agent):
    result: CompletenessResult = completeness_agent.run(
        question="What is hypertension?",
        ai_response="",
        reference_answer="Hypertension is defined as persistent blood pressure above 130/80 mmHg.",
    )

    assert result.score <= 20
    assert result.status == "incomplete"

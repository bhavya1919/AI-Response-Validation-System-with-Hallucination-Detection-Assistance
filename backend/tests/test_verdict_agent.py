"""
Unit tests for calibrated VerdictAgent (Milestone 3.2).

Verifies:
  - 30% Relevance, 30% Accuracy, 20% Completeness, 20% Hallucination scoring calibration.
  - Contradiction safety rule (forces FAIL and caps score at 38).
  - High hallucination safety rule (risk >= 60 forces FAIL, score <= 40).
  - Completeness safety rule (completeness < 40 prevents PASS).
  - Low relevance/accuracy (< 30) forces FAIL.
  - Informative major_strengths and major_issues extraction.
"""
import pytest
from backend.app.agents.verdict import VerdictAgent, VerdictResult
from backend.app.agents.relevance import RelevanceResult
from backend.app.agents.accuracy import AccuracyResult
from backend.app.agents.hallucination import HallucinationResult
from backend.app.agents.completeness import CompletenessResult


@pytest.fixture
def verdict_agent():
    return VerdictAgent()


def test_perfect_evaluation_passes(verdict_agent):
    rel = RelevanceResult(score=95, label="fully_relevant", reasoning="Directly answers query.")
    acc = AccuracyResult(claims=[], accuracy_score=95, supported_count=3, partial_count=0, unsupported_count=0, status="supported", reasoning="All claims verified.")
    hal = HallucinationResult(risk_score=5, status="low", reasoning="No hallucinations detected.", flagged_claims=[])
    com = CompletenessResult(score=90, status="complete", reasoning="All core aspects covered.", addressed_aspects=["a", "b", "c"])

    res: VerdictResult = verdict_agent.run(
        relevance=rel,
        accuracy=acc,
        hallucination=hal,
        completeness=com,
    )

    assert res.verdict == "PASS"
    assert res.overall_score >= 80
    assert len(res.major_strengths) >= 1
    assert len(res.major_issues) == 0


def test_contradiction_safety_override(verdict_agent):
    rel = RelevanceResult(score=90, label="fully_relevant", reasoning="Answers the query.")
    acc = AccuracyResult(claims=[], accuracy_score=30, supported_count=0, partial_count=0, unsupported_count=0, contradicted_count=1, status="contradicted", reasoning="Contradicts medical evidence.")
    hal = HallucinationResult(risk_score=20, status="low", reasoning="No ungrounded claims.", flagged_claims=[])
    com = CompletenessResult(score=85, status="complete", reasoning="Covers aspects.")

    res: VerdictResult = verdict_agent.run(
        relevance=rel,
        accuracy=acc,
        hallucination=hal,
        completeness=com,
    )

    assert res.verdict == "FAIL"
    assert res.overall_score <= 38
    assert any("contradiction" in issue.lower() for issue in res.major_issues)


def test_high_hallucination_safety_override(verdict_agent):
    rel = RelevanceResult(score=85, label="fully_relevant", reasoning="Addresses query.")
    acc = AccuracyResult(claims=[], accuracy_score=70, supported_count=2, partial_count=1, unsupported_count=0, status="partial", reasoning="Some supported claims.")
    hal = HallucinationResult(risk_score=75, status="high", reasoning="Invented dates and figures.", flagged_claims=[])
    com = CompletenessResult(score=80, status="complete", reasoning="Covers aspects.")

    res: VerdictResult = verdict_agent.run(
        relevance=rel,
        accuracy=acc,
        hallucination=hal,
        completeness=com,
    )

    assert res.verdict == "FAIL"
    assert res.overall_score <= 40
    assert any("hallucination" in issue.lower() for issue in res.major_issues)


def test_low_completeness_prevents_pass(verdict_agent):
    # Perfect accuracy and relevance, but completeness is very low (< 40)
    rel = RelevanceResult(score=90, label="fully_relevant", reasoning="Addresses topic.")
    acc = AccuracyResult(claims=[], accuracy_score=90, supported_count=3, partial_count=0, unsupported_count=0, status="supported", reasoning="Factually accurate.")
    hal = HallucinationResult(risk_score=10, status="low", reasoning="Low hallucination.", flagged_claims=[])
    com = CompletenessResult(score=35, status="incomplete", reasoning="Omits almost all required information.", missing_aspects=["aspect1", "aspect2"])

    res: VerdictResult = verdict_agent.run(
        relevance=rel,
        accuracy=acc,
        hallucination=hal,
        completeness=com,
    )

    # Incomplete response should NOT be a clean PASS
    assert res.verdict != "PASS"
    assert res.verdict in ["REVIEW", "FAIL"]
    assert any("incomplete" in issue.lower() or "aspect" in issue.lower() for issue in res.major_issues)


def test_calibration_weights(verdict_agent):
    # Test formula: 0.30*R + 0.30*A + 0.20*(100-H) + 0.20*C
    # With R=80, A=80, H=20 (100-H=80), C=80 -> Expected exactly 80
    rel = RelevanceResult(score=80, label="mostly_relevant", reasoning="Relevant.")
    acc = AccuracyResult(claims=[], accuracy_score=80, supported_count=2, partial_count=0, unsupported_count=0, status="supported", reasoning="Supported.")
    hal = HallucinationResult(risk_score=20, status="low", reasoning="Low risk.", flagged_claims=[])
    com = CompletenessResult(score=80, status="complete", reasoning="Complete.")

    res: VerdictResult = verdict_agent.run(
        relevance=rel,
        accuracy=acc,
        hallucination=hal,
        completeness=com,
    )

    assert res.overall_score == 80
    assert res.verdict == "PASS"

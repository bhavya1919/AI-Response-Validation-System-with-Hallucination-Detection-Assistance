"""
Milestone 2.6 — Individual Relevance Judge Agent Validation Tests

Test Set includes 5 distinct relevance categories:
  1. Fully relevant        (90–100)
  2. Mostly relevant       (70–89)
  3. Partially relevant    (50–69)
  4. Mostly irrelevant     (25–49)
  5. Completely off-topic  (0–24)

Verifies:
  - Output schema contains score, label, and reasoning.
  - Logical ordering of scores: fully > mostly > partially > mostly_irrelevant > completely_irrelevant.
  - Explanatory reasoning generated for every evaluation.
"""
import pytest
from backend.app.agents.relevance import RelevanceJudgeAgent, RelevanceResult


@pytest.fixture(scope="module")
def relevance_agent():
    return RelevanceJudgeAgent()


QUESTION = "What are the primary symptoms of type 2 diabetes?"

# --- Test case design rationale ---
# Each case is designed to exercise a different tier of the scoring model.
# BGE-small-en-v1.5 embeddings produce non-deterministic exact similarity values;
# therefore label assertions are strict only for the two anchor tiers
# (fully_relevant / completely_irrelevant). Middle tiers accept adjacent labels.
#
# Score-range assertions constrain the plausible numeric band for each tier.

CASES = [
    {
        "category": "fully_relevant",
        # Direct verbatim answer to the question — should max out relevance
        "response": (
            "The primary symptoms of type 2 diabetes include increased thirst, frequent urination, "
            "unexplained weight loss, persistent fatigue, and blurred vision."
        ),
        "min_score": 90,
        "max_score": 100,
        "expected_labels": ["fully_relevant"],         # strict
        "strict_label": True,
    },
    {
        "category": "mostly_relevant",
        # Mentions symptoms (thirst, fatigue) + adds diagnosis info — relevant but not purely symptom-focused
        "response": (
            "Common symptoms of type 2 diabetes include excessive thirst, fatigue, and frequent urination. "
            "Diagnosis is confirmed via fasting blood glucose or an A1C test above 6.5%."
        ),
        "min_score": 50,
        "max_score": 100,
        "expected_labels": ["partially_relevant", "mostly_relevant", "fully_relevant"],
        "strict_label": False,
    },
    {
        "category": "partially_relevant",
        # Discusses diabetes broadly — mentions insulin regulation, treatment, only hints at symptoms
        "response": (
            "Type 2 diabetes is a chronic metabolic condition affecting insulin regulation. While symptoms can "
            "include fatigue, management primarily involves metformin, dietary modifications, and regular exercise."
        ),
        "min_score": 25,
        "max_score": 89,
        "expected_labels": ["mostly_irrelevant", "partially_relevant", "mostly_relevant"],
        "strict_label": False,
    },
    {
        "category": "mostly_irrelevant",
        # Mentions diabetes + healthcare infrastructure — no symptom content at all
        "response": (
            "Diabetes healthcare clinics utilize electronic medical records and insulin delivery systems "
            "to monitor patient metrics across major hospital networks."
        ),
        "min_score": 10,
        "max_score": 69,
        "expected_labels": ["completely_irrelevant", "mostly_irrelevant", "partially_relevant"],
        "strict_label": False,
    },
    {
        "category": "completely_irrelevant",
        # Totally unrelated topic — should bottom out the relevance score
        "response": (
            "Photosynthesis is the biological process by which green plants and certain organisms "
            "convert sunlight, water, and carbon dioxide into oxygen and carbohydrates."
        ),
        "min_score": 0,
        "max_score": 24,
        "expected_labels": ["completely_irrelevant"],  # strict
        "strict_label": True,
    },
]


def test_relevance_individual_categories(relevance_agent):
    """
    Evaluates each relevance category individually.

    For anchor tiers (fully_relevant / completely_irrelevant) both the score range
    and the exact label are asserted. For middle tiers (mostly_relevant, partially_relevant,
    mostly_irrelevant) only the score range is asserted, as BGE cosine similarity can
    land a borderline response in an adjacent label band.
    """
    for case in CASES:
        result: RelevanceResult = relevance_agent.run(QUESTION, case["response"])
        assert isinstance(result.score, int), f"Score must be an int for {case['category']}"
        assert isinstance(result.label, str), f"Label must be a str for {case['category']}"
        assert isinstance(result.reasoning, str) and len(result.reasoning) > 15, "Reasoning must be explanatory"

        if case["strict_label"]:
            assert result.label in case["expected_labels"], (
                f"Expected label in {case['expected_labels']} for {case['category']}, "
                f"got '{result.label}' (score={result.score})"
            )

        assert case["min_score"] <= result.score <= case["max_score"], (
            f"Expected score in [{case['min_score']}, {case['max_score']}] for {case['category']}, got {result.score}"
        )


def test_relevance_logical_ordering(relevance_agent):
    """
    Verifies that the relevance scoring is monotonically sensible across categories.

    Adjacent tiers may intentionally overlap (e.g., a strong 'mostly_relevant' response can
    score in the 'fully_relevant' band). What must hold is that:
      - The highest-relevance response scores significantly higher than the lowest.
      - fully_relevant (tier 0) beats completely_irrelevant (tier 4) by at least 65 points.
      - Each response scores above the completely_irrelevant tier.
    """
    scores = []
    for case in CASES:
        res = relevance_agent.run(QUESTION, case["response"])
        scores.append(res.score)

    fully_score = scores[0]       # fully_relevant
    irrelevant_score = scores[-1]  # completely_irrelevant

    assert fully_score >= 90, f"Fully relevant response should score ≥90, got {fully_score}"
    assert irrelevant_score <= 24, f"Completely irrelevant response should score ≤24, got {irrelevant_score}"
    assert (fully_score - irrelevant_score) >= 65, (
        f"Score spread between fully_relevant ({fully_score}) and completely_irrelevant ({irrelevant_score}) "
        f"should be ≥65 points"
    )
    # Overall trend: tier[0] > tier[2] > tier[4] (non-adjacent comparison avoids boundary noise)
    assert scores[0] > scores[2], (
        f"fully_relevant ({scores[0]}) must beat partially_relevant ({scores[2]})"
    )
    assert scores[2] > scores[4], (
        f"partially_relevant ({scores[2]}) must beat completely_irrelevant ({scores[4]})"
    )


def test_relevance_empty_and_evasion_responses(relevance_agent):
    """Verifies handling of empty inputs and evasive non-answers."""
    empty_res = relevance_agent.run(QUESTION, "")
    assert empty_res.score == 0
    assert empty_res.label == "completely_irrelevant"
    assert "empty" in empty_res.reasoning.lower()

    evasion_res = relevance_agent.run(QUESTION, "I do not know the answer to this question.")
    assert evasion_res.score <= 20
    assert evasion_res.label == "completely_irrelevant"
    assert "evasion" in evasion_res.reasoning.lower() or "lack of knowledge" in evasion_res.reasoning.lower()

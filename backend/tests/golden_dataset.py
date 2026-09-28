"""
Golden Evaluation Test Set for VeriAI (Phase 3.2)

200 independent test cases spanning categories A through J (20 per category):
  A. Clearly correct factual responses          -> PASS,   low risk
  B. Clearly incorrect responses                -> FAIL,   high/critical risk
  C. Hallucinated responses                     -> FAIL,   critical risk
  D. Partially correct responses                -> REVIEW, moderate risk
  E. Contradictory responses                    -> FAIL,   critical risk
  F. Irrelevant / off-topic responses           -> FAIL,   high risk
  G. Correct + unsupported additional claims    -> REVIEW, moderate risk
  H. Incomplete responses                       -> REVIEW, low risk
  I. Reference-grounded responses (mixed)       -> PASS/REVIEW/FAIL
  J. Knowledge-base coverage gaps               -> REVIEW/FAIL, moderate risk

LABEL INDEPENDENCE:
All expected_verdict, expected_risk, expected_score_min/max are assigned
independently from evaluator output.
"""
from dataclasses import dataclass
from typing import Optional, List


@dataclass
class GoldenTestCase:
    id: str
    category: str
    category_name: str
    question: str
    ai_response: str
    reference_answer: Optional[str]
    expected_verdict: str
    expected_risk: str
    expected_score_min: int
    expected_score_max: int
    notes: str
    target_dataset: Optional[str] = None


PLACEHOLDER = "DATASET_LOADED"

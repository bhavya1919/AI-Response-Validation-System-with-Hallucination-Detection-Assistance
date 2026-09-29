"""
VerdictAgent — Step 4 (final) of the VeriAI multi-agent pipeline.

Synthesizes signals from RelevanceJudge, Retriever, Accuracy, Hallucination,
and Completeness agents into a structured, human-readable verdict with an
overall score and comprehensive reasoning.

M3 Scoring weights (30 / 30 / 20 / 20):
  - Relevance     30 %
  - Accuracy      30 %
  - Completeness  20 %
  - Hallucination-adjusted  20 %  (100 - risk)

M3 Safety rules:
  - Contradiction / incorrect claims  → FAIL, overall ≤ 38
  - Severe hallucination (≥ 60 %)     → FAIL, overall ≤ 40
  - Low relevance (< 30)              → FAIL
  - Low accuracy  (< 30)              → FAIL
  - Low completeness (< 40)           → prevents PASS
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any

from backend.app.agents.accuracy import AccuracyResult
from backend.app.agents.hallucination import HallucinationResult
from backend.app.agents.retriever import RetrieverResult
from backend.app.agents.relevance import RelevanceResult
from backend.app.agents.completeness import CompletenessResult


@dataclass
class Reason:
    text: str
    positive: bool


@dataclass
class VerdictResult:
    overall_score: int
    verdict: str           # "PASS" | "REVIEW" | "FAIL"
    confidence: str        # "high" | "medium" | "low"
    scores: Dict[str, int]
    reasons: List[Reason]
    evaluated_at: str
    reasoning: str = ""
    major_strengths: List[str] = field(default_factory=list)
    major_issues: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "label": self.verdict,
            "verdict": self.verdict,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
            "scores": self.scores,
            "reasons": [{"text": r.text, "positive": r.positive} for r in self.reasons],
            "major_strengths": self.major_strengths,
            "major_issues": self.major_issues,
        }


class VerdictAgent:
    """
    Combines all agent outputs into a final scored verdict (M3 calibrated).
    """

    def run(
        self,
        accuracy: AccuracyResult,
        hallucination: HallucinationResult,
        question: str = "",
        ai_response: str = "evaluated response",
        retriever: Optional[RetrieverResult] = None,
        reference_answer: Optional[str] = None,
        relevance: Optional[RelevanceResult] = None,
        completeness: Optional[CompletenessResult] = None,
    ) -> VerdictResult:

        # ── Edge Case: empty response ────────────────────────────────────
        clean_resp = ai_response.strip() if ai_response else ""
        if not clean_resp:
            return VerdictResult(
                overall_score=0,
                verdict="FAIL",
                confidence="high",
                scores={"relevance": 0, "accuracy": 0, "hallucinationRisk": 100, "completeness": 0},
                reasons=[Reason(text="AI response is empty — evaluation failed.", positive=False)],
                evaluated_at="Just now",
                reasoning="Evaluation failed: the AI response was empty.",
                major_strengths=[],
                major_issues=["Response was completely empty — nothing to evaluate."],
            )

        # ── Component scores ─────────────────────────────────────────────
        accuracy_score = accuracy.accuracy_score

        if relevance is not None:
            relevance_score = relevance.score
        else:
            relevance_score = 0
            if retriever and retriever.evidence:
                relevance_score = min(100, int(retriever.evidence[0].score * 100))
            if reference_answer and reference_answer.strip() and (accuracy.supported_count > 0 or accuracy.partial_count > 0):
                relevance_score = max(relevance_score, 88)

        hallucination_adjusted = max(0, 100 - hallucination.hallucination_risk)

        if completeness is not None:
            completeness_score = completeness.score
        else:
            # Legacy keyword-coverage fallback
            stopwords = {"the","a","an","is","are","was","were","what","who",
                         "when","where","how","why","did","do","does","in","of",
                         "to","and","or","for","with","about"}
            words = re.findall(r"\b[a-zA-Z]{3,}\b", question.lower())
            keywords = [w for w in words if w not in stopwords]
            if keywords:
                matched = sum(1 for kw in keywords if kw in clean_resp.lower())
                completeness_score = min(100, int(matched / len(keywords) * 100))
            else:
                completeness_score = 75

        # ── M3 weighted overall (30 / 30 / 20 / 20) ──────────────────────
        overall = int(
            relevance_score        * 0.30
            + accuracy_score       * 0.30
            + completeness_score   * 0.20
            + hallucination_adjusted * 0.20
        )
        overall = min(100, max(0, overall))

        # Check if inquiry reflects a KB coverage gap without reference answer
        is_kb_gap = (
            retriever is not None
            and retriever.evidence_status in ("weak", "unavailable")
            and not (reference_answer and reference_answer.strip())
            and not hallucination.contradiction_detected
            and accuracy.contradicted_count == 0
            and accuracy.incorrect_count == 0
        )

        # ── M3 Safety rules & verdict ─────────────────────────────────────
        if hallucination.contradiction_detected or accuracy.contradicted_count > 0 or accuracy.incorrect_count > 0:
            verdict = "FAIL"
            overall = min(overall, 38)
        elif hallucination.hallucination_risk >= 60:
            verdict = "FAIL"
            overall = min(overall, 40)
        elif reference_answer and accuracy.unsupported_count > 0 and hallucination.hallucination_risk >= 35:
            # An ungrounded/fabricated claim attached to an authoritative reference ground truth
            verdict = "FAIL"
            overall = min(overall, 40)
        elif relevance_score < 30:
            verdict = "FAIL"
            overall = min(overall, 35)
        elif accuracy_score < 30 and not is_kb_gap:
            verdict = "FAIL"
            overall = min(overall, 35)
        elif completeness_score < 55:
            # Substantially incomplete response cannot PASS
            if overall >= 45:
                verdict = "REVIEW"
            else:
                verdict = "FAIL"
        elif is_kb_gap:
            # KB coverage gap for arbitrary queries without reference answer:
            # Cannot confirm accuracy, but no contradiction detected. Score reflects relevance and completeness.
            overall = max(48, min(65, overall))
            verdict = "REVIEW"
        elif completeness is not None and completeness.missing_aspects and len(completeness.missing_aspects) > 0:
            # Response is demonstrably missing one or more required concepts/aspects
            verdict = "REVIEW"
        elif (
            accuracy.supported_count > 0
            and accuracy.unsupported_count == 0
            and accuracy.partial_count == 0
            and hallucination.hallucination_risk < 20
            and completeness_score >= 60
            and overall >= 68
        ):
            verdict = "PASS"
        elif overall >= 78 and accuracy.unsupported_count == 0 and accuracy.partial_count == 0 and completeness_score >= 60:
            verdict = "PASS"
        elif (
            overall >= 80
            and accuracy.unsupported_count == 0
            and accuracy.contradicted_count == 0
            and accuracy.incorrect_count == 0
            and hallucination.hallucination_risk < 20
            and completeness_score >= 70
        ):
            verdict = "PASS"
        elif overall >= 45:
            verdict = "REVIEW"
        else:
            verdict = "FAIL"

        # ── Confidence ────────────────────────────────────────────────────
        if reference_answer and reference_answer.strip():
            confidence = "high"
        elif retriever and retriever.evidence_status == "strong" and accuracy.supported_count >= 1:
            confidence = "high"
        elif retriever and retriever.evidence_status == "moderate" and accuracy.supported_count >= 1:
            confidence = "medium"
        elif retriever and retriever.evidence_status in ("weak", "unavailable"):
            confidence = "low"
        elif accuracy.supported_count >= 1:
            confidence = "medium"
        else:
            confidence = "low"

        # ── Reasons ───────────────────────────────────────────────────────
        reasons: List[Reason] = []

        if reference_answer and reference_answer.strip():
            reasons.append(Reason(
                text="Grounding Mode: Grounded against authoritative Reference Answer and Knowledge Base evidence.",
                positive=True,
            ))
        elif retriever and retriever.evidence_status in ("weak", "unavailable"):
            reasons.append(Reason(
                text=f"Knowledge Base Coverage: Evidence status is {retriever.evidence_status.upper()}. Evaluation reflects topic relevance and conceptual completeness without verified grounding.",
                positive=False,
            ))

        if relevance_score >= 70:
            reasons.append(Reason(
                text=f"High relevance ({relevance_score}%) — response directly addresses question scope.",
                positive=True,
            ))
        else:
            reasons.append(Reason(
                text=f"Low relevance ({relevance_score}%) — response has limited alignment with the question.",
                positive=False,
            ))

        if accuracy.supported_count > 0:
            reasons.append(Reason(
                text=f"{accuracy.supported_count} of {len(accuracy.claims)} claim(s) directly supported by verified evidence.",
                positive=True,
            ))
        if accuracy.unsupported_count > 0:
            reasons.append(Reason(
                text=f"{accuracy.unsupported_count} claim(s) could not be verified against available evidence.",
                positive=False,
            ))
        if accuracy.partial_count > 0:
            reasons.append(Reason(
                text=f"{accuracy.partial_count} claim(s) only partially supported — secondary review recommended.",
                positive=False,
            ))

        if hallucination.contradiction_detected:
            reasons.append(Reason(
                text=hallucination.contradiction_note or "Factual contradiction detected against reference ground truth.",
                positive=False,
            ))
        elif hallucination.hallucination_risk < 15:
            reasons.append(Reason(
                text=f"Hallucination risk low at {hallucination.hallucination_risk}% — response aligns with canonical evidence.",
                positive=True,
            ))
        elif hallucination.hallucination_risk < 40:
            reasons.append(Reason(
                text=f"Hallucination risk moderate at {hallucination.hallucination_risk}% — some claims require inspection.",
                positive=False,
            ))
        else:
            reasons.append(Reason(
                text=f"High hallucination risk ({hallucination.hallucination_risk}%) — unverified assertions detected.",
                positive=False,
            ))

        if hallucination.evidence_sufficiency_note:
            reasons.append(Reason(text=hallucination.evidence_sufficiency_note, positive=False))

        if completeness_score >= 70:
            reasons.append(Reason(
                text=f"Response comprehensively addresses the question ({completeness_score}% completeness).",
                positive=True,
            ))
        elif completeness_score >= 40:
            reasons.append(Reason(
                text=f"Response partially covers question scope ({completeness_score}% completeness).",
                positive=False,
            ))
        else:
            reasons.append(Reason(
                text=f"Response is substantially incomplete ({completeness_score}% completeness) — key aspects missing.",
                positive=False,
            ))

        # ── Major strengths & issues ──────────────────────────────────────
        major_strengths: List[str] = []
        major_issues: List[str] = []

        if relevance_score >= 75:
            major_strengths.append(f"Strong topic relevance ({relevance_score}/100)")
        if accuracy_score >= 70:
            major_strengths.append(f"High factual accuracy ({accuracy_score}/100)")
        if hallucination.hallucination_risk < 15:
            major_strengths.append("Very low hallucination risk")
        if completeness_score >= 70:
            major_strengths.append(f"Comprehensive coverage ({completeness_score}/100 completeness)")
        if accuracy.supported_count > 0 and accuracy.unsupported_count == 0:
            major_strengths.append("All verified claims supported by evidence")
        if reference_answer and reference_answer.strip():
            major_strengths.append("Evaluated against authoritative reference answer")

        if relevance_score < 50:
            major_issues.append(f"Low relevance to question ({relevance_score}/100)")
        if accuracy_score < 50:
            major_issues.append(f"Low factual accuracy ({accuracy_score}/100)")
        if hallucination.hallucination_risk >= 40:
            major_issues.append(f"High hallucination risk ({hallucination.hallucination_risk}%)")
        if hallucination.contradiction_detected or accuracy.contradicted_count > 0:
            major_issues.append("Factual contradiction with ground truth detected")
        if completeness_score < 50:
            major_issues.append(f"Incomplete response — missing key aspects ({completeness_score}/100)")
        if accuracy.unsupported_count > 0:
            major_issues.append(f"{accuracy.unsupported_count} unverified claim(s) present")
        if accuracy.incorrect_count > 0:
            major_issues.append("Contains incorrect factual claims")

        # Fallback for strengths
        if not major_strengths:
            major_strengths.append("Response is non-empty and attempts to address the question")

        # ── Verdict reasoning narrative ───────────────────────────────────
        if verdict == "PASS":
            if hallucination.hallucination_risk < 15:
                narrative = (
                    "The response is directly relevant and factually accurate, with all key claims strongly "
                    f"supported by verified evidence and low hallucination risk ({hallucination.hallucination_risk}%)."
                )
            else:
                narrative = (
                    "The response is relevant, accurate, and sufficiently complete, with adequate grounding "
                    "in verified evidence to earn a passing verdict."
                )
        elif verdict == "REVIEW":
            if is_kb_gap:
                narrative = (
                    "The response directly addresses the question, but factual claims could not be verified "
                    "due to insufficient reference documentation in the knowledge base. A reference answer or "
                    "domain-specific corpus is recommended for definitive validation."
                )
            else:
                rel_phrase = (
                    "directly relevant" if relevance_score >= 85 else
                    "mostly relevant" if relevance_score >= 70 else "partially relevant"
                )
                acc_phrase = "mostly accurate" if accuracy_score >= 60 else "partially supported"
                narrative = (
                    f"The response is {rel_phrase} and {acc_phrase}, but some claims lack sufficient "
                    f"supporting evidence, resulting in {hallucination.status} hallucination risk "
                    f"({hallucination.hallucination_risk}%)."
                )
            if completeness and len(completeness.missing_aspects) > 0 and not is_kb_gap:
                narrative += f" Note: {len(completeness.missing_aspects)} requested aspect(s) were omitted."
        else:
            if hallucination.contradiction_detected or accuracy.contradicted_count > 0 or accuracy.incorrect_count > 0:
                narrative = (
                    "The response contains factual contradictions or incorrect assertions directly conflicting "
                    f"with verified ground truth, resulting in an elevated hallucination risk "
                    f"({hallucination.hallucination_risk}%)."
                )
            elif relevance_score < 35:
                narrative = (
                    f"The response is off-topic with low relevance ({relevance_score}/100) and fails to "
                    "address the question scope adequately."
                )
            elif completeness_score < 30:
                narrative = (
                    f"The response is critically incomplete ({completeness_score}/100 completeness), "
                    "failing to address the majority of required aspects."
                )
            else:
                narrative = (
                    f"The response failed evaluation due to low factual accuracy ({accuracy_score}/100) "
                    f"and elevated hallucination risk ({hallucination.hallucination_risk}%)."
                )

        verdict_reasoning = (
            f"{narrative} Final verdict is {verdict} with an overall score of {overall}/100 "
            f"({confidence} confidence). Scoring: Relevance {relevance_score}/100 (×30%), "
            f"Accuracy {accuracy_score}/100 (×30%), Completeness {completeness_score}/100 (×20%), "
            f"Hallucination-adjusted {hallucination_adjusted}/100 (×20%)."
        )

        return VerdictResult(
            overall_score=overall,
            verdict=verdict,
            confidence=confidence,
            scores={
                "relevance": relevance_score,
                "accuracy": accuracy_score,
                "hallucinationRisk": hallucination.hallucination_risk,
                "completeness": completeness_score,
            },
            reasons=reasons,
            evaluated_at="Just now",
            reasoning=verdict_reasoning,
            major_strengths=major_strengths,
            major_issues=major_issues,
        )

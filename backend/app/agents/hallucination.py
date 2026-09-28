"""
HallucinationDetectionAgent — Step 3 of the VeriAI multi-agent pipeline (Milestone 2 Compliance).

Responsibilities:
  1. Receive factual claims from AccuracyAgent.
  2. Receive retrieved evidence from RetrieverAgent.
  3. Cross-reference each claim with evidence.
  4. Identify: SUPPORTED, UNSUPPORTED, CONTRADICTED.
  5. Specifically flag problematic claims.
  6. Explain WHY each claim was flagged with claim-level reasoning.
  7. Return structured output:
     {
         "status": "low/moderate/high/critical",
         "risk_score": number,
         "reasoning": "...",
         "flagged_claims": [
             {
                 "claim": "...",
                 "status": "UNSUPPORTED",
                 "reasoning": "...",
                 "evidence": "..."
             }
         ]
     }
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

from backend.app.agents.accuracy import AccuracyResult, ClaimResult
from backend.app.agents.retriever import EvidenceChunk
from backend.app.services.embedding import embedding_service


@dataclass
class FlaggedClaim:
    claim: str
    status: str          # "UNSUPPORTED" | "CONTRADICTED" | "HALLUCINATED"
    reasoning: str
    evidence: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "claim": self.claim,
            "status": self.status,
            "reasoning": self.reasoning,
            "evidence": self.evidence,
        }


@dataclass
class HallucinationResult:
    status: str                  # "low" | "moderate" | "high" | "critical"
    risk_score: int              # 0-100 (percentage)
    reasoning: str
    flagged_claims: List[FlaggedClaim]
    contradiction_detected: bool = False
    contradiction_note: str = ""
    evidence_sufficiency_note: str = ""

    # Legacy properties for backward compatibility with existing code
    @property
    def hallucination_risk(self) -> int:
        return self.risk_score

    @property
    def risk_label(self) -> str:
        return self.status

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "risk_score": self.risk_score,
            "reasoning": self.reasoning,
            "flagged_claims": [f.to_dict() for f in self.flagged_claims],
        }


_CONTRADICTION_THRESHOLD = 0.30


class HallucinationAgent:
    """
    Evaluates claims against retrieved evidence and ground truth to detect
    unsupported assertions, factual contradictions, and hallucinations.
    """

    def run(
        self,
        accuracy: AccuracyResult,
        evidence: List[EvidenceChunk],
        ai_response: str,
        reference_answer: Optional[str] = None,
        evidence_status: str = "moderate",
    ) -> HallucinationResult:
        total_claims = len(accuracy.claims)

        # ── Edge Case: Empty response / No claims ──────────────────────────────
        if total_claims == 0:
            clean_resp = (ai_response or "").strip()
            if not clean_resp:
                return HallucinationResult(
                    status="critical",
                    risk_score=100,
                    reasoning="AI response is empty; evaluation failed.",
                    flagged_claims=[
                        FlaggedClaim(
                            claim="Empty response",
                            status="UNSUPPORTED",
                            reasoning="No response content was provided to evaluate.",
                            evidence="None",
                        )
                    ],
                    contradiction_detected=False,
                    contradiction_note="",
                    evidence_sufficiency_note="No claims provided in response.",
                )
            return HallucinationResult(
                status="low",
                risk_score=0,
                reasoning="No verifiable factual claims detected in the response.",
                flagged_claims=[],
                contradiction_detected=False,
                contradiction_note="",
                evidence_sufficiency_note="No factual claims identified.",
            )

        flagged: List[FlaggedClaim] = []
        contradiction_detected = False
        contradiction_note = ""

        # ── Cross-reference each claim ─────────────────────────────────────────
        for c in accuracy.claims:
            c_status_upper = c.status.upper()

            if c_status_upper in ("CONTRADICTED", "INCORRECT"):
                contradiction_detected = True
                # If there is authoritative reference answer or direct evidence clash, classify accurately
                is_direct_fabrication = "Reference Ground Truth" in (c.evidence_text or "")
                tag = "HALLUCINATED" if is_direct_fabrication else "CONTRADICTED"
                flag_reason = (
                    f"Available evidence conflicts with the claim. {c.note}"
                )
                flagged.append(FlaggedClaim(
                    claim=c.claim,
                    status=tag,
                    reasoning=flag_reason,
                    evidence=c.evidence_text,
                ))

            elif c_status_upper == "UNSUPPORTED":
                flag_reason = (
                    "Not supported by available evidence: the knowledge base does not contain reference data for this claim."
                    if evidence_status in ("weak", "unavailable") and not reference_answer
                    else "No sufficient evidence found in the knowledge base or reference ground truth to support this claim."
                )
                flagged.append(FlaggedClaim(
                    claim=c.claim,
                    status="UNSUPPORTED",
                    reasoning=flag_reason,
                    evidence=c.evidence_text or "No matching evidence",
                ))

            elif c_status_upper == "PARTIAL":
                flag_reason = (
                    f"Partial grounding only (similarity {c.similarity:.2f}). "
                    "Claim has minor discrepancy or lacks complete evidence backing."
                )
                flagged.append(FlaggedClaim(
                    claim=c.claim,
                    status="PARTIAL",
                    reasoning=flag_reason,
                    evidence=c.evidence_text,
                ))

        # ── Semantic Divergence / Contradiction Check on Full Response ──────────
        has_ref = bool(reference_answer and reference_answer.strip())
        if has_ref and accuracy.supported_count == 0 and total_claims > 0:
            ref_vec = embedding_service.embed_text(reference_answer.strip())
            ai_vec = embedding_service.embed_text(ai_response.strip()) if ai_response.strip() else [0.0] * len(ref_vec)
            sim = sum(a * b for a, b in zip(ref_vec, ai_vec))
            if sim < _CONTRADICTION_THRESHOLD:
                contradiction_detected = True
                contradiction_note = (
                    f"AI response has very low semantic similarity ({sim:.2f}) to the "
                    "reference answer — potential factual contradiction detected."
                )

        # ── Risk Score Calculation ─────────────────────────────────────────────
        # Evidence sufficiency distinction:
        # If the KB simply lacks evidence for this topic and there is no contradiction against ground truth,
        # ungrounded claims reflect an unverified state (coverage gap), NOT confirmed fabrications.
        is_coverage_gap = (
            evidence_status in ("weak", "unavailable")
            and not reference_answer
            and not contradiction_detected
            and accuracy.contradicted_count == 0
            and accuracy.incorrect_count == 0
        )

        if is_coverage_gap:
            unsupported_weight = 0.25
            partial_weight = 0.15
            raw_risk = (
                accuracy.unsupported_count * unsupported_weight
                + accuracy.partial_count * partial_weight
            ) / total_claims
            risk_score = min(30, max(15, int(round(raw_risk * 100))))
        else:
            # Standard risk weighting
            # Contradicted / Incorrect: weight 1.0
            # Unsupported: weight 0.85
            # Partial: weight 0.35
            raw_risk = (
                accuracy.contradicted_count * 1.0
                + accuracy.incorrect_count * 0.90
                + accuracy.unsupported_count * 0.85
                + accuracy.partial_count * 0.35
            ) / total_claims
            risk_score = min(100, max(0, int(round(raw_risk * 100))))

        if contradiction_detected:
            risk_score = max(risk_score, 85)
            if not contradiction_note:
                contradiction_note = f"{len([f for f in flagged if f.status in ('CONTRADICTED', 'HALLUCINATED')])} claim(s) directly conflict with verified ground truth."

        # Evidence sufficiency distinction
        evidence_sufficiency_note = ""
        if evidence_status in ("weak", "unavailable") and not reference_answer:
            evidence_sufficiency_note = (
                f"Knowledge base evidence sufficiency is {evidence_status.upper()}. "
                "Unverified claims reflect KB coverage limitations rather than confirmed factual fabrication."
            )

        # ── Status Classification ──────────────────────────────────────────────
        # low: 0-14
        # moderate: 15-34
        # high: 35-59
        # critical: 60-100
        if risk_score < 15:
            status = "low"
        elif risk_score < 35:
            status = "moderate"
        elif risk_score < 60:
            status = "high"
        else:
            status = "critical"

        # ── Explanatory Reasoning ──────────────────────────────────────────────
        if is_coverage_gap:
            reasoning = (
                f"Moderate unverified risk ({risk_score}%). Claims could not be corroborated because the knowledge "
                "base does not contain sufficient reference documentation for this question topic. "
                "This indicates an evidence coverage limitation rather than confirmed factual fabrication."
            )
        elif status == "low":
            reasoning = (
                f"Low hallucination risk ({risk_score}%). All {total_claims} factual claim(s) are corroborated "
                "by verified evidence with no detected contradictions or unsupported assertions."
            )
        elif status == "moderate":
            reasoning = (
                f"Moderate hallucination risk ({risk_score}%). Some claims lack complete authoritative backing, "
                "though no direct factual contradictions were identified."
            )
        elif status == "high":
            reasoning = (
                f"High hallucination risk ({risk_score}%). Multiple factual assertions lack grounding in the "
                "knowledge base or reference answer."
            )
        else:
            reasoning = (
                f"Critical hallucination risk ({risk_score}%). Severe factual contradictions or fabricated claims "
                "directly conflicting with verified ground truth were detected."
            )

        return HallucinationResult(
            status=status,
            risk_score=risk_score,
            reasoning=reasoning,
            flagged_claims=flagged,
            contradiction_detected=contradiction_detected,
            contradiction_note=contradiction_note,
            evidence_sufficiency_note=evidence_sufficiency_note,
        )

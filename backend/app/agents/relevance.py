"""
RelevanceJudgeAgent — Milestone 2.1 Compliance Implementation

Responsibilities:
  1. Evaluate whether the AI response directly addresses the question.
  2. Distinguish:
     - fully_relevant        (90–100)
     - mostly_relevant       (70–89)
     - partially_relevant    (50–69)
     - mostly_irrelevant     (25–49)
     - completely_irrelevant (0–24)
  3. Return a defined 0–100 score.
  4. Generate clear, evidence-based reasoning for every evaluation.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Optional

from backend.app.agents.retriever import EvidenceChunk
from backend.app.services.embedding import embedding_service


@dataclass
class RelevanceResult:
    score: int          # 0-100
    label: str          # "fully_relevant" | "mostly_relevant" | "partially_relevant" | "mostly_irrelevant" | "completely_irrelevant"
    reasoning: str
    label_display: str = ""
    signals: Optional[dict] = None


# Common English stopwords to ignore when checking key term overlap
_STOPWORDS = {
    "a", "an", "the", "in", "on", "at", "by", "for", "with", "about", "against",
    "between", "into", "through", "during", "before", "after", "above", "below",
    "to", "from", "up", "down", "in", "out", "over", "under", "again", "further",
    "then", "once", "here", "there", "when", "where", "why", "how", "all", "any",
    "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor",
    "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can",
    "will", "just", "don", "should", "now", "is", "are", "was", "were", "be",
    "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing",
    "what", "who", "which", "whom", "this", "that", "these", "those", "am", "it",
    "its", "tell", "me", "please", "could", "would", "you"
}

_EVASION_PATTERNS = [
    r"i (do not|don'?t) (know|have|possess)",
    r"i am (an|a) (ai|language model|virtual assistant)",
    r"as an ai",
    r"i cannot answer",
    r"i am unable to answer",
    r"no information (available|provided)",
    r"not mentioned in the (text|context)",
    r"it is not possible to answer",
]


def _extract_keywords(text: str) -> List[str]:
    """Extracts non-stopword tokens of length >= 2."""
    words = re.findall(r"\b[a-zA-Z0-9_\-']+\b", text.lower())
    return [w for w in words if w not in _STOPWORDS and len(w) > 1]


def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Dot product of unit-normalized embedding vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    return max(0.0, min(1.0, sum(a * b for a, b in zip(vec_a, vec_b))))


class RelevanceJudgeAgent:
    """
    Dedicated Judge Agent for evaluating the relevance of an AI response to a given question.
    Combines semantic vector similarity, key term coverage, evasion detection,
    retrieved evidence alignment, and ground-truth reference corroboration.
    """

    def run(
        self,
        question: str,
        ai_response: str,
        evidence: Optional[List[EvidenceChunk]] = None,
        reference_answer: Optional[str] = None,
    ) -> RelevanceResult:
        clean_q = (question or "").strip()
        clean_r = (ai_response or "").strip()

        # ── Edge Case 1: Empty inputs ──────────────────────────────────────────
        if not clean_r:
            return RelevanceResult(
                score=0,
                label="completely_irrelevant",
                label_display="Completely Off-Topic",
                reasoning="The AI response is empty and does not address the question.",
                signals={
                    "semantic_similarity": 0.0,
                    "keyword_coverage": 0.0,
                    "topic_alignment": "none",
                    "matched_concepts": [],
                    "missing_concepts": _extract_keywords(clean_q),
                },
            )

        if not clean_q:
            return RelevanceResult(
                score=0,
                label="completely_irrelevant",
                label_display="Completely Off-Topic",
                reasoning="No question was submitted to evaluate relevance against.",
                signals={
                    "semantic_similarity": 0.0,
                    "keyword_coverage": 0.0,
                    "topic_alignment": "none",
                    "matched_concepts": [],
                    "missing_concepts": [],
                },
            )

        # ── Check for explicit evasion or non-answer ───────────────────────────
        r_lower = clean_r.lower()
        is_evasion = any(re.search(pat, r_lower) for pat in _EVASION_PATTERNS)
        if is_evasion and len(clean_r.split()) < 25:
            return RelevanceResult(
                score=15,
                label="completely_irrelevant",
                label_display="Completely Off-Topic",
                reasoning=(
                    "The response contains an evasion or admission of lack of knowledge "
                    "without providing any substantive answer to the question."
                ),
                signals={
                    "semantic_similarity": 0.15,
                    "keyword_coverage": 0.0,
                    "topic_alignment": "evasion",
                    "matched_concepts": [],
                    "missing_concepts": _extract_keywords(clean_q),
                },
            )

        # ── 1. Semantic Embedding Similarity ──────────────────────────────────
        q_vec = embedding_service.embed_text(clean_q)
        r_vec = embedding_service.embed_text(clean_r)
        semantic_sim = _cosine_similarity(q_vec, r_vec)

        # ── 2. Keyword & Concept Coverage ──────────────────────────────────────
        q_keywords = _extract_keywords(clean_q)
        r_keywords_set = set(_extract_keywords(clean_r))

        if q_keywords:
            matched_kw = [k for k in q_keywords if k in r_keywords_set]
            kw_coverage = len(matched_kw) / len(q_keywords)
        else:
            kw_coverage = 1.0
            matched_kw = []

        # ── 3. Evidence Contextual Alignment ───────────────────────────────────
        evidence_boost = 0.0
        if evidence:
            best_ev_sim = 0.0
            for ev in evidence[:5]:
                ev_vec = embedding_service.embed_text(ev.content[:300])
                ev_r_sim = _cosine_similarity(ev_vec, r_vec)
                if ev_r_sim > best_ev_sim:
                    best_ev_sim = ev_r_sim
            if best_ev_sim >= 0.70:
                evidence_boost = 0.12
            elif best_ev_sim >= 0.55:
                evidence_boost = 0.06

        # ── 4. Reference Answer Corroboration ──────────────────────────────────
        ref_sim = 0.0
        has_ref = bool(reference_answer and reference_answer.strip())
        if has_ref:
            ref_vec = embedding_service.embed_text(reference_answer.strip())
            ref_sim = _cosine_similarity(ref_vec, r_vec)
            r_ans_lower = reference_answer.strip().lower()
            if r_ans_lower in r_lower or r_lower in r_ans_lower:
                ref_sim = max(ref_sim, 0.95)

        # ── 5. Scoring Synthesis (Calibrated for BGE Representation) ───────────
        # Reference answer override if available
        if has_ref:
            if ref_sim >= 0.75:
                composite = max(0.94, (0.50 * _cosine_similarity(q_vec, r_vec)) + (0.50 * ref_sim))
            elif ref_sim >= 0.58:
                composite = max(0.76, ref_sim)
            else:
                composite = 0.50 * ref_sim
        else:
            # Baseline BGE floor is ~0.40-0.45 for arbitrary English sentences
            if semantic_sim < 0.50 and kw_coverage == 0.0:
                raw_score = int(max(0, min(24, (semantic_sim - 0.30) * 100)))
                composite = raw_score / 100.0
            else:
                norm_semantic = max(0.0, min(1.0, (semantic_sim - 0.40) / 0.52))
                composite = (0.60 * norm_semantic) + (0.40 * kw_coverage) + evidence_boost
                if kw_coverage == 0.0:
                    composite = min(composite, 0.24)

        score = max(0, min(100, int(round(composite * 100))))

        # ── 6. Label Determination ─────────────────────────────────────────────
        # 90–100: fully_relevant
        # 70–89:  mostly_relevant
        # 50–69:  partially_relevant
        # 25–49:  mostly_irrelevant
        # 0–24:   completely_irrelevant

        if score >= 90:
            label = "fully_relevant"
            qualifier = "directly and comprehensively answers the question with closely matched topical content"
        elif score >= 70:
            label = "mostly_relevant"
            qualifier = "mostly answers the question with relevant focus and minor extraneous detail"
        elif score >= 50:
            label = "partially_relevant"
            qualifier = "partially answers the question but omits core aspects or includes peripheral material"
        elif score >= 25:
            label = "mostly_irrelevant"
            qualifier = "exhibits only a weak relationship to the question with little substantive topical overlap"
        else:
            label = "completely_irrelevant"
            qualifier = "is off-topic and fails to address the submitted question"

        LABEL_DISPLAYS = {
            "fully_relevant": "Fully Relevant",
            "mostly_relevant": "Mostly Relevant",
            "partially_relevant": "Partially Relevant",
            "mostly_irrelevant": "Mostly Irrelevant",
            "completely_irrelevant": "Completely Off-Topic",
        }
        label_display = LABEL_DISPLAYS.get(label, "Mostly Relevant")

        # ── 7. Reasoning Generation ────────────────────────────────────────────
        kw_pct = int(round(kw_coverage * 100))
        reasoning = (
            f"The response {qualifier}. "
            f"Semantic alignment score is {semantic_sim:.2f} with {kw_pct}% key inquiry term coverage "
            f"({len(matched_kw)}/{len(q_keywords)} question concepts addressed)."
        )

        signals = {
            "semantic_similarity": round(float(semantic_sim), 2),
            "keyword_coverage": round(float(kw_coverage), 2),
            "topic_alignment": "high" if semantic_sim >= 0.72 else ("moderate" if semantic_sim >= 0.50 else "low"),
            "matched_concepts": matched_kw,
            "missing_concepts": [k for k in q_keywords if k not in r_keywords_set],
        }

        return RelevanceResult(
            score=score,
            label=label,
            label_display=label_display,
            reasoning=reasoning,
            signals=signals,
        )

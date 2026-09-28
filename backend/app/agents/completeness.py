"""
CompletenessJudgeAgent — Step 3b of the VeriAI M3 multi-agent pipeline.

Analyses which aspects of the question the AI response addresses, partially
covers, or misses entirely.  Works in two modes:
  - Reference-grounded : canonical reference_answer is provided.
  - RAG-grounded       : falls back to retrieved pgvector evidence chunks.

Scoring (0–100):
  score = round((addressed * 1.0 + partial * 0.5) / total * 100), clipped to [0,100]
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class CompletenessResult:
    score: int                                                  # 0–100
    status: str = "complete"                                   # "complete" | "partial" | "incomplete"
    addressed_aspects: List[str] = field(default_factory=list)  # aspects the response covers well
    partial_aspects: List[str] = field(default_factory=list)    # aspects only partially covered
    missing_aspects: List[str] = field(default_factory=list)    # aspects not addressed at all
    covered_aspects: List[str] = field(default_factory=list)    # union of addressed + partial
    reasoning: str = ""                                        # human-readable explanation

    def to_dict(self):
        return {
            "score": self.score,
            "status": self.status,
            "addressed_aspects": self.addressed_aspects,
            "partial_aspects": self.partial_aspects,
            "missing_aspects": self.missing_aspects,
            "covered_aspects": self.covered_aspects,
            "reasoning": self.reasoning,
        }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_STOPWORDS = frozenset({
    "the", "a", "an", "is", "are", "was", "were", "what", "who", "when",
    "where", "how", "why", "did", "do", "does", "in", "of", "to", "and",
    "or", "for", "with", "about", "that", "this", "these", "those", "it",
    "its", "be", "been", "being", "have", "has", "had", "will", "would",
    "could", "should", "may", "might", "can", "not", "no", "but", "if",
    "on", "at", "by", "from", "up", "out", "as", "into", "through", "between",
    "explain", "describe", "discuss", "define", "detail", "compare", "contrast",
    "tell", "give", "list", "show", "name", "provide", "please", "which",
})


def _extract_keywords(text: str, max_kw: int = 12) -> List[str]:
    """Return the top non-trivial content words from *text* (including 2+ char acronyms)."""
    words = re.findall(r"\b[a-zA-Z0-9]{2,}\b", text.lower())
    seen: set = set()
    kws: List[str] = []
    for w in words:
        if w not in _STOPWORDS and w not in seen:
            seen.add(w)
            kws.append(w)
        if len(kws) >= max_kw:
            break
    return kws


def _extract_aspects(source_text: str) -> List[str]:
    """
    Heuristically extract 'aspects' (noun-phrase-ish sentences / bullet items)
    from a reference answer or evidence chunk.

    For short references (1-2 sentences) we also inject named-entity sub-aspects
    so that key proper nouns (e.g. "Alexander Fleming") are evaluated individually
    rather than being diluted inside a single long-sentence aspect.
    """
    # Split on sentence boundaries or bullet markers
    raw = re.split(r"(?<=[.!?])\s+|(?:\n\s*[-•*]\s*)", source_text)
    aspects: List[str] = []
    for part in raw:
        part = part.strip().strip(".")
        if len(part) > 12:               # ignore tiny fragments
            aspects.append(part)
    # Deduplicate while preserving order
    seen: set = set()
    unique: List[str] = []
    for a in aspects:
        key = a.lower()[:40]
        if key not in seen:
            seen.add(key)
            unique.append(a)

    # Fallback for short reference answers (e.g. "Paris", "4", "42")
    if not unique:
        for part in raw:
            part = part.strip().strip(".")
            if part and part.lower()[:40] not in seen:
                seen.add(part.lower()[:40])
                unique.append(part)
        if not unique and source_text.strip():
            unique.append(source_text.strip())

    # For short references (≤2 aspects / sentences), also add named-entity
    # sub-aspects so that key proper nouns (e.g. "Alexander Fleming") are
    # evaluated independently rather than being buried in a long sentence aspect.
    if len(unique) <= 2:
        # Common English words that appear capitalised only as sentence starters
        # and should NOT be treated as named entities
        _NOT_NAMED_ENTITIES = frozenset({
            "the", "a", "an", "common", "symptoms", "treatment", "treatments",
            "causes", "cause", "effects", "effect", "examples", "example",
            "description", "definition", "overview", "introduction", "summary",
            "history", "background", "conclusion", "however", "therefore",
            "although", "because", "since", "while", "when", "where", "which",
            "this", "these", "those", "that", "such", "many", "some", "most",
            "all", "both", "each", "every", "any", "other", "another",
            "first", "second", "third", "finally", "additionally", "moreover",
            "furthermore", "consequently", "thus", "hence",
        })

        # Prefer multi-word proper names (two consecutive Title-Case words)
        # e.g. "Alexander Fleming", "St Mary" → strong signal of a proper noun
        multi_word_entities = re.findall(
            r"\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+)\b", source_text
        )
        for entity in multi_word_entities:
            entity_lower = entity.lower()
            if entity_lower not in _NOT_NAMED_ENTITIES:
                entity_aspect = f"Coverage of concept: '{entity_lower}'"
                if entity_aspect not in unique:
                    unique.append(entity_aspect)

        # Also add single mid-sentence capitalized words (not sentence-starters)
        # by scanning for Title-Case words preceded by a lowercase context word
        single_mid_entities = re.findall(
            r"(?<=[a-z]\s)([A-Z][a-z]{3,})\b", source_text
        )
        for entity in single_mid_entities:
            entity_lower = entity.lower()
            if entity_lower not in _NOT_NAMED_ENTITIES:
                entity_aspect = f"Coverage of concept: '{entity_lower}'"
                if entity_aspect not in unique:
                    unique.append(entity_aspect)

    return unique[:10]                   # cap at 10 aspects


def _response_covers(aspect: str, response_lower: str) -> float:
    """
    Simple keyword-overlap similarity between an aspect phrase and the response.
    Returns a float in [0.0, 1.0].
    """
    m = re.match(r"^Coverage of concept: '([^']+)'$", aspect)
    if m:
        concept = m.group(1).lower()
        if concept in response_lower:
            return 1.0
        # Check semantic/contrast equivalents for common concepts
        if concept in ("difference", "differ", "differs"):
            contrast_words = ["different", "differ", "differs", "whereas", "while", "unlike", "contrast"]
            if any(w in response_lower for w in contrast_words):
                return 1.0
        if len(concept) >= 5 and concept[:4] in response_lower:
            return 0.75
        return 0.0

    kws = _extract_keywords(aspect)
    if not kws:
        clean_aspect = aspect.strip().lower()
        if clean_aspect and (clean_aspect in response_lower or re.search(r"\b" + re.escape(clean_aspect) + r"\b", response_lower)):
            return 1.0
        return 0.0
    matched = sum(1 for kw in kws if kw in response_lower)
    return matched / len(kws)


# ---------------------------------------------------------------------------
# Agent
# ---------------------------------------------------------------------------

class CompletenessJudgeAgent:
    """
    Determines how completely an AI response covers the question's requirements.
    """

    def run(
        self,
        question: str,
        ai_response: str,
        reference_answer: Optional[str] = None,
        evidence_chunks: Optional[List[Any]] = None,
        evidence: Optional[List[Any]] = None,
        evidence_status: str = "moderate",
    ) -> CompletenessResult:

        clean_resp = (ai_response or "").strip()

        # ── Edge: empty response ──────────────────────────────────────────
        if not clean_resp:
            return CompletenessResult(
                score=0,
                status="incomplete",
                addressed_aspects=[],
                partial_aspects=[],
                missing_aspects=["The AI response is empty — no aspects addressed."],
                covered_aspects=[],
                reasoning="The AI response was empty. Completeness score is 0/100.",
            )

        resp_lower = clean_resp.lower()

        # Normalize evidence inputs (strings or EvidenceChunk objects)
        ev_raw = evidence_chunks if evidence_chunks is not None else evidence
        ev_strings: List[str] = []
        if ev_raw:
            for item in ev_raw:
                if isinstance(item, str):
                    ev_strings.append(item)
                elif hasattr(item, "content"):
                    ev_strings.append(getattr(item, "content"))

        # Check if retrieved evidence has substantive relevance to the question
        q_kws = _extract_keywords(question, max_kw=6)
        ev_has_relevance = False
        if ev_strings and q_kws and evidence_status in ("strong", "moderate"):
            combined_ev = " ".join(ev_strings[:3]).lower()
            ev_has_relevance = any(kw in combined_ev for kw in q_kws)

        # ── Derive aspects from grounding source ──────────────────────────
        if reference_answer and reference_answer.strip():
            grounding_mode = "reference_answer"
            source_text = reference_answer.strip()
        elif ev_strings and ev_has_relevance and evidence_status in ("strong", "moderate"):
            grounding_mode = "rag_evidence"
            source_text = " ".join(ev_strings[:3])
        else:
            grounding_mode = "question_keywords"
            source_text = ""

        if source_text:
            raw_aspects = _extract_aspects(source_text)
        else:
            # Fall back: derive expected aspects from question keywords
            q_kws = _extract_keywords(question, max_kw=6)
            raw_aspects = [f"Coverage of concept: '{kw}'" for kw in q_kws]

        if not raw_aspects:
            raw_aspects = ["General response quality"]

        # ── Classify each aspect ──────────────────────────────────────────
        addressed: List[str] = []
        partial: List[str] = []
        missing: List[str] = []

        for aspect in raw_aspects:
            coverage = _response_covers(aspect, resp_lower)
            # Shorten long aspects for display
            display = aspect if len(aspect) <= 90 else aspect[:87] + "…"
            if coverage >= 0.60:
                addressed.append(display)
            elif coverage >= 0.25:
                partial.append(display)
            else:
                missing.append(display)

        total = len(raw_aspects)
        raw_score = (len(addressed) * 1.0 + len(partial) * 0.5) / total * 100
        score = min(100, max(0, round(raw_score)))

        # ── Status label ──────────────────────────────────────────────────
        if score >= 75:
            status = "complete"
        elif score >= 40:
            status = "partial"
        else:
            status = "incomplete"

        covered_aspects = addressed + partial

        # ── Reasoning narrative ───────────────────────────────────────────
        mode_label = {
            "reference_answer": "the canonical reference answer",
            "rag_evidence":     "retrieved knowledge base evidence",
            "question_keywords": "key concepts in the question",
        }[grounding_mode]

        if status == "complete":
            summary = (
                f"The response comprehensively covers the expected content. "
                f"Based on {mode_label}, {len(addressed)} of {total} aspects are "
                f"well-addressed"
                + (f" and {len(partial)} are partially covered" if partial else "")
                + "."
            )
        elif status == "partial":
            summary = (
                f"The response partially covers the expected content. "
                f"Based on {mode_label}, {len(addressed)} aspect(s) are addressed, "
                f"{len(partial)} are partially covered, and {len(missing)} are missing."
            )
        else:
            summary = (
                f"The response is substantially incomplete. "
                f"Based on {mode_label}, only {len(addressed)} aspect(s) are addressed "
                f"and {len(missing)} important aspect(s) are not covered at all."
            )

        if missing:
            missing_preview = "; ".join(f"\"{m[:55]}\"" for m in missing[:3])
            summary += f" Key missing topics include: {missing_preview}."

        reasoning = (
            f"{summary} "
            f"Completeness score: {score}/100 ({status})."
        )

        return CompletenessResult(
            score=score,
            status=status,
            addressed_aspects=addressed,
            partial_aspects=partial,
            missing_aspects=missing,
            covered_aspects=covered_aspects,
            reasoning=reasoning,
        )

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
    # Split on sentence boundaries, coordinate contrast conjunctions, or bullet markers
    raw = re.split(r"(?<=[.!?])\s+|(?:\n\s*[-•*]\s*)|\s+whereas\s+|\s+while\s+|\s+and\s+(?=the\s+\w+\s+is\b)", source_text)
    aspects: List[str] = []
    for part in raw:
        # Strip parenthetical notes that are auxiliary explanations
        part_clean = re.sub(r"\s*\([^)]*\)", "", part).strip().strip(".")
        if re.search(r'\bincluding\b', part_clean, re.I):
            core_part = re.sub(r'\s+including\s+.*?(?=\s+over\b|\s+through\b|\s+via\b|\s+using\b|$)', '', part_clean, flags=re.I).strip().strip('.')
            if len(core_part) > 12:
                aspects.append(core_part)
        if len(part_clean) > 12:               # ignore tiny fragments
            aspects.append(part_clean)
        elif len(part.strip().strip(".")) > 12:
            aspects.append(part.strip().strip("."))
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
    # evaluated independently rather than being diluted inside a single long-sentence aspect.
    if len(unique) <= 2:
        # Clean parenthetical expressions from source_text so auxiliary notes (e.g. alternate units)
        # are not turned into mandatory sub-aspect concepts
        clean_source = re.sub(r"\s*\([^)]*\)", "", source_text)

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

        # Coordination list in short references (e.g. "red yellow and blue", "red, yellow, and blue", "involves a, b, c")
        matches_list = list(re.finditer(r'\b(?:are|include|includes|involves?|consists? of)\s+([a-zA-Z\s,/-]+?)(?:\.|$)', clean_source, re.I))
        for m_list in matches_list:
            raw_items = re.split(r'[, ]+|\band\b|/', m_list.group(1))
            for item in raw_items:
                item = item.strip().lower()
                if len(item) >= 3 and item not in _STOPWORDS and item not in _NOT_NAMED_ENTITIES:
                    concept_aspect = f"Coverage of concept: '{item}'"
                    if concept_aspect not in unique:
                        unique.append(concept_aspect)

        # Prefer multi-word proper names (two consecutive Title-Case words)
        multi_word_entities = re.findall(
            r"\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})+)\b", clean_source
        )
        for entity in multi_word_entities:
            entity_lower = entity.lower()
            if entity_lower not in _NOT_NAMED_ENTITIES:
                entity_aspect = f"Coverage of concept: '{entity_lower}'"
                if entity_aspect not in unique:
                    unique.append(entity_aspect)

        # Single mid-sentence or comma-separated capitalized words (e.g. 'Agra', 'India')
        single_entities = re.findall(
            r"(?:(?<=[a-z]\s)|(?<=,\s)|(?<=in\s)|(?<=at\s)|(?<=to\s))([A-Z][a-z]{2,})\b", clean_source
        )
        for entity in single_entities:
            entity_lower = entity.lower()
            if entity_lower not in _NOT_NAMED_ENTITIES:
                # Do not add single word if already covered inside a multi-word entity
                is_sub = any(entity_lower in u.lower() for u in unique if "Coverage of concept" in u)
                if not is_sub:
                    entity_aspect = f"Coverage of concept: '{entity_lower}'"
                    if entity_aspect not in unique:
                        unique.append(entity_aspect)

    # Filter out duplicate sub-aspects
    filtered_unique: List[str] = []
    for u in unique:
        m = re.match(r"^Coverage of concept: '([^']+)'$", u)
        if m:
            val = m.group(1).lower()
            # If val is a single word and already part of a multi-word concept in unique, skip
            if len(val.split()) == 1:
                has_parent = any(
                    val in o.lower() and o != u and "Coverage of concept" in o
                    for o in unique
                )
                if has_parent:
                    continue
        filtered_unique.append(u)

    return filtered_unique[:10]


_COMPLETENESS_SYNONYMS = [
    {"produce", "produced", "producing", "synthesize", "synthesized", "synthesizing", "create", "created", "make", "made"},
    {"inhale", "inhales", "inhaling", "breathe", "breathes", "breathing", "respiration"},
    {"cell", "cells", "cellular"},
    {"day", "days"},
    {"hour", "hours"},
    {"week", "weeks"},
    {"british", "britain", "uk", "kingdom", "united kingdom", "england", "english"},
    {"led", "lead", "leader", "prime", "minister", "premier", "ruled", "governed"},
    {"war", "world war", "wwii", "ww2"},
    {"delivery", "delivers", "delivered", "transmission", "transmitting"},
    {"services", "service", "power", "resources"},
    {"prioritizes", "prioritize", "optimizes", "optimize", "focuses", "focus"},
    {"speed", "fast", "low-latency", "latency", "quick"},
    {"demand", "on-demand", "pay-as-you-go"},
    {"cost", "costs", "trade-off", "tradeoff", "expense"},
    {"space", "storage"},
    {"database", "databases"},
    {"earth", "world", "globe"},
]

def _is_covered_single_kw(kw: str, resp_norm: str) -> bool:
    if kw in resp_norm:
        return True
    if len(kw) > 4 and kw[:-1] in resp_norm:
        return True
    if len(kw) >= 6:
        stem = kw[:5]
        if re.search(r'\b' + re.escape(stem), resp_norm):
            return True
    for group in _COMPLETENESS_SYNONYMS:
        if kw in group and any(term in resp_norm for term in group):
            return True
    return False


def _is_covered_kw(kw: str, resp_norm: str) -> bool:
    if _is_covered_single_kw(kw, resp_norm):
        return True
    words = [w for w in re.findall(r'\b\w+\b', kw.lower()) if w not in _STOPWORDS and len(w) >= 2]
    if len(words) > 1:
        return all(_is_covered_single_kw(w, resp_norm) for w in words)
    return False


def _response_covers(aspect: str, response_lower: str) -> float:
    """
    Keyword-overlap similarity between an aspect phrase and the response with synonym support.
    Returns a float in [0.0, 1.0].
    """
    resp_norm = response_lower.replace("=", " equals ")
    aspect_norm = aspect.lower().replace("=", " equals ")

    m = re.match(r"^Coverage of concept: '([^']+)'$", aspect)
    if m:
        concept = m.group(1).lower().replace("=", " equals ")
        if concept in resp_norm:
            return 1.0
        # Check semantic/contrast equivalents for common concepts
        if concept in ("difference", "differ", "differs"):
            contrast_words = ["different", "differ", "differs", "whereas", "while", "unlike", "contrast"]
            if any(w in resp_norm for w in contrast_words):
                return 1.0
        if len(concept) >= 5 and concept[:4] in resp_norm:
            return 0.75
        return 0.0

    kws = _extract_keywords(aspect_norm)
    # Ignore pure filler adverbs
    kws = [kw for kw in kws if not (kw.endswith("ly") and len(kw) >= 6)]
    if not kws:
        clean_aspect = aspect_norm.strip()
        if clean_aspect and (clean_aspect in resp_norm or re.search(r"\b" + re.escape(clean_aspect) + r"\b", resp_norm)):
            return 1.0
        return 0.0
    matched = sum(1 for kw in kws if _is_covered_kw(kw, resp_norm))
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

        q_lower = (question or "").lower()
        for aspect in raw_aspects:
            coverage = _response_covers(aspect, resp_lower)
            # Shorten long aspects for display
            display = aspect if len(aspect) <= 90 else aspect[:87] + "…"
            if coverage >= 0.60:
                addressed.append(display)
            elif coverage >= 0.30:
                partial.append(display)
            else:
                # If this is a concept sub-aspect that is entirely part of the question prompt itself,
                # do not penalize as missing if the main content has already been addressed
                m_c = re.match(r"^Coverage of concept: '([^']+)'$", aspect)
                if m_c and m_c.group(1).lower() in q_lower and len(addressed) > 0:
                    continue
                missing.append(display)

        total = len(addressed) + len(partial) + len(missing)
        if total == 0:
            total = 1
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

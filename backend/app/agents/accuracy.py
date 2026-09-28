"""
AccuracyAgent — Step 2 of the VeriAI multi-agent pipeline (Milestone 2 Compliance).

Splits the AI response into sentence-level claims, embeds each one,
and scores it against the reference answer (if available) or retrieved evidence pool (RAG).

Classifies claims into:
  - SUPPORTED
  - PARTIAL
  - INCORRECT
  - CONTRADICTED
  - UNSUPPORTED

Returns:
  - accuracy score (0-100)
  - reasoning
  - supporting evidence
  - claim-level results
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Tuple, Optional, Dict, Any

from backend.app.agents.retriever import EvidenceChunk
from backend.app.services.embedding import embedding_service


@dataclass
class ClaimResult:
    claim: str
    status: str          # "SUPPORTED" | "PARTIAL" | "INCORRECT" | "CONTRADICTED" | "UNSUPPORTED"
    evidence_text: str
    source: str
    relevance: int       # 0-100
    note: str
    similarity: float = 0.0
    confidence: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "claim": self.claim,
            "status": self.status,
            "similarity": round(self.similarity, 4),
            "evidence": self.evidence_text,
            "source": self.source,
            "relevance": self.relevance,
            "note": self.note,
            "confidence": round(self.confidence, 4),
        }


@dataclass
class AccuracyResult:
    claims: List[ClaimResult]
    accuracy_score: int          # 0-100
    supported_count: int
    partial_count: int
    unsupported_count: int
    contradicted_count: int = 0
    incorrect_count: int = 0
    reasoning: str = ""
    status: str = ""

    @property
    def score(self) -> int:
        return self.accuracy_score

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.accuracy_score,
            "reasoning": self.reasoning,
            "claims": [c.to_dict() for c in self.claims],
        }


# BGE-small-en cosine similarity calibrated thresholds:
# Identical/paraphrased facts score >= 0.82
# Topically related but distinct facts score 0.60–0.82
# Unrelated/unsupported content scores below 0.60
_SUPPORTED_THRESHOLD = 0.82
_PARTIAL_THRESHOLD   = 0.60


def _split_sentences(text: str) -> List[str]:
    """
    Sentence splitter that avoids splitting on common abbreviations
    (St., Dr., Mr., Mrs., Jr., Sr., U.S., etc.)
    """
    if not text or not text.strip():
        return []

    abbrevs = ["St.", "Dr.", "Mr.", "Mrs.", "Ms.", "Jr.", "Sr.", "U.S.", "U.K.",
               "vs.", "etc.", "i.e.", "e.g.", "Fig.", "No.", "Vol.", "pp."]
    masked = text
    placeholders: List[tuple] = []
    for i, ab in enumerate(abbrevs):
        ph = f"__ABBREV{i}__"
        if ab in masked:
            masked = masked.replace(ab, ph)
            placeholders.append((ph, ab))

    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9])', masked.strip())

    result = []
    for s in sentences:
        for ph, ab in placeholders:
            s = s.replace(ph, ab)
        s = s.strip()
        if s:
            result.append(s)

    return result if result else [text.strip()]


def _cosine_sim(a: List[float], b: List[float]) -> float:
    """Dot product of two already-normalized BGE unit vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    return max(0.0, min(1.0, sum(x * y for x, y in zip(a, b))))


def _detect_polarity_clash(claim: str, reference: str) -> bool:
    """Checks if claim and reference answer hold opposing polarity on the same topic."""
    c_low = claim.lower().strip()
    r_low = reference.lower().strip()

    # Leading Yes vs No clash
    c_starts_yes = bool(re.match(r"^(yes|definitely|certainly|true|i can)\b", c_low))
    c_starts_no  = bool(re.match(r"^(no|not|never|false|cannot|incapable)\b", c_low))
    r_starts_yes = bool(re.match(r"^(yes|definitely|certainly|true|i can)\b", r_low))
    r_starts_no  = bool(re.match(r"^(no|not|never|false|cannot|incapable)\b", r_low))

    if (c_starts_yes and r_starts_no) or (c_starts_no and r_starts_yes):
        return True

    # Check for direct antonym contradiction
    neg_tokens = {"no", "not", "never", "false", "fake", "myth", "cannot", "incapable", "nothing"}
    c_neg = any(re.search(rf"\b{tok}\b", c_low) for tok in neg_tokens)
    r_neg = any(re.search(rf"\b{tok}\b", r_low) for tok in neg_tokens)

    # If one contains a strong negative and the other affirms the exact same key phrase
    if c_neg != r_neg:
        c_words = set(re.findall(r"\b\w{4,}\b", c_low)) - neg_tokens
        r_words = set(re.findall(r"\b\w{4,}\b", r_low)) - neg_tokens
        shared = c_words & r_words
        if len(shared) >= 2:
            return True

    return False


_STOPWORDS_ACC = frozenset({
    "the", "a", "an", "is", "are", "was", "were", "what", "who", "when",
    "where", "how", "why", "did", "do", "does", "in", "of", "to", "and",
    "or", "for", "with", "about", "that", "this", "these", "those", "it",
    "its", "be", "been", "being", "have", "has", "had", "will", "would",
    "could", "should", "may", "might", "can", "not", "no", "but", "if",
    "on", "at", "by", "from", "up", "out", "as", "into", "through",
})


def _detect_entity_clash(claim: str, reference: str) -> bool:
    """
    Detects when a claim *substitutes* key proper nouns/entities from the reference
    (e.g. "Berlin" vs "Paris", "George Washington" vs "Abraham Lincoln").

    Does NOT flag:
    - Claims that merely *add* new context entities (e.g. "at St Mary's Hospital").
    - Claims using third-person pronouns (He/She/They/It) as the subject — these
      use coreference to a prior sentence's entity, so the named entity is correctly
      absent from this specific sentence.
    - Short claims with few extra entities relative to missing ones.
    """
    # Guard: pronoun-subject sentences use coreference; don't penalise missing antecedent
    claim_stripped = claim.strip()
    _PRONOUNS = re.compile(r"^(He|She|They|It|We|This|That|These|Those)\b", re.IGNORECASE)
    if _PRONOUNS.match(claim_stripped):
        return False

    c_words = set(re.findall(r"\b[a-zA-Z0-9]{3,}\b", claim.lower())) - _STOPWORDS_ACC
    r_words = set(re.findall(r"\b[a-zA-Z0-9]{3,}\b", reference.lower())) - _STOPWORDS_ACC

    c_caps = set(w.lower() for w in re.findall(r"\b[A-Z][a-zA-Z0-9]{2,}\b", claim)) - _STOPWORDS_ACC
    r_caps = set(w.lower() for w in re.findall(r"\b[A-Z][a-zA-Z0-9]{2,}\b", reference)) - _STOPWORDS_ACC

    shared = c_words & r_words
    # Must have enough topical overlap to be talking about the same thing
    if len(r_words) > 0 and (len(shared) / len(r_words) >= 0.35 or len(shared) >= 2):
        missing_caps = r_caps - c_caps
        extra_caps = c_caps - r_caps
        if missing_caps and extra_caps:
            # Threshold by reference entity count:
            #   1 entity  → 100% must be missing (pure single-entity substitution)
            #   2 entities → 50%+ missing (at least 1 key entity swapped out)
            #   3+ entities → 66%+ missing (majority substitution)
            if len(r_caps) == 1:
                threshold = 1.0
            elif len(r_caps) == 2:
                threshold = 0.5
            else:
                threshold = 0.66
            if len(r_caps) > 0 and (len(missing_caps) / len(r_caps)) >= threshold:
                return True
    return False


def _detect_year_clash(claim: str, reference: str) -> bool:
    """Detects when claim asserts an opposing year or date to the reference."""
    years_in_claim = set(re.findall(r"\b(1[0-9]{3}|20[0-9]{2})\b", claim))
    years_in_ref   = set(re.findall(r"\b(1[0-9]{3}|20[0-9]{2})\b", reference))

    if years_in_claim and years_in_ref and not (years_in_claim & years_in_ref):
        return True
    return False


class AccuracyAgent:
    """
    Evaluates each factual claim in the AI response:
      - Against reference answer if provided.
      - Against retrieved knowledge chunks (RAG) if reference answer is unavailable.
    """

    def run(
        self,
        ai_response: str,
        evidence: List[EvidenceChunk],
        reference_answer: Optional[str] = None,
    ) -> AccuracyResult:
        sentences = _split_sentences(ai_response)
        if not sentences:
            return AccuracyResult(
                claims=[],
                accuracy_score=0,
                supported_count=0,
                partial_count=0,
                unsupported_count=0,
                contradicted_count=0,
                incorrect_count=0,
                reasoning="The AI response was empty; no factual claims could be identified.",
                status="No Claims",
            )

        # Pre-embed all sentence claims
        claim_vecs = embedding_service.embed_documents(sentences)

        # Pre-embed reference answer if present
        ref_vec: Optional[List[float]] = None
        has_ref = bool(reference_answer and reference_answer.strip())
        if has_ref:
            ref_vec = embedding_service.embed_text(reference_answer.strip())

        # Pre-embed top evidence chunks in batch (cap at 10 for performance)
        chunk_vecs: List[List[float]] = []
        top_evidence = evidence[:10] if evidence else []
        if top_evidence:
            chunk_texts = [c.content for c in top_evidence]
            chunk_vecs = embedding_service.embed_documents(chunk_texts)

        claims: List[ClaimResult] = []
        supported = 0
        partial = 0
        unsupported = 0
        contradicted = 0
        incorrect = 0

        for sentence, claim_vec in zip(sentences, claim_vecs):
            best_score = -1.0
            best_chunk: Optional[EvidenceChunk] = None
            is_ref_match = False
            is_ref_partial = False
            is_contradiction = False
            is_incorrect = False

            # ── Check 1: Direct comparison against reference answer (highest authority) ──
            if ref_vec is not None and reference_answer:
                ref_sim = _cosine_sim(claim_vec, ref_vec)
                s_low = sentence.lower().strip()
                r_low = reference_answer.lower().strip()

                if _detect_year_clash(sentence, reference_answer):
                    # Factual mismatch in years/dates
                    is_incorrect = True
                    best_score = 0.35
                elif _detect_polarity_clash(sentence, reference_answer):
                    # Opposing polarity assertion
                    is_contradiction = True
                    best_score = ref_sim
                elif _detect_entity_clash(sentence, reference_answer):
                    # Opposing entity/proper noun substitution
                    is_incorrect = True
                    best_score = 0.30
                elif (
                    ref_sim >= 0.75
                    or (len(r_low) >= 4 and r_low in s_low)
                    or (len(s_low) >= 4 and s_low in r_low)
                    or (s_low in ("no.", "yes.", "no", "yes") and r_low.startswith(s_low.rstrip(".")))
                ):
                    best_score = max(ref_sim, 0.92)
                    is_ref_match = True
                elif ref_sim >= 0.58:
                    best_score = ref_sim
                    is_ref_partial = True
                else:
                    # Still evaluate against KB if ref answer didn't fully match this specific sentence
                    best_score = ref_sim

            # ── Check 2: Evaluate against retrieved KB evidence pool ───────────────────
            if chunk_vecs and not is_ref_match and not is_ref_partial and not is_contradiction and not is_incorrect:
                for j, chunk_vec in enumerate(chunk_vecs):
                    sim = _cosine_sim(claim_vec, chunk_vec)
                    if sim > best_score:
                        best_score = sim
                        best_chunk = top_evidence[j]

            # ── Assign claim status and confidence ────────────────────────────────────
            if is_contradiction:
                status = "CONTRADICTED"
                note = "Directly contradicts the verified reference ground truth."
                evidence_text = f"Reference Ground Truth: {reference_answer}"
                source = "Reference Answer"
                sim_float = round(best_score, 4)
                confidence = 0.95
                relevance_pct = max(0, int(best_score * 100))
                contradicted += 1
            elif is_incorrect:
                status = "INCORRECT"
                note = "Contains factual inaccuracies (date, entity, or numerical discrepancy) relative to reference ground truth."
                evidence_text = f"Reference Ground Truth: {reference_answer}"
                source = "Reference Answer"
                sim_float = round(best_score, 4)
                confidence = 0.92
                relevance_pct = max(0, int(best_score * 100))
                incorrect += 1
            elif is_ref_match:
                status = "SUPPORTED"
                note = "Directly corroborated by authoritative reference answer."
                evidence_text = f"Reference Ground Truth: {reference_answer}"
                source = "Reference Answer"
                sim_float = round(best_score, 4)
                confidence = min(0.98, max(0.85, round(best_score, 2)))
                relevance_pct = min(100, max(0, int(best_score * 100)))
                supported += 1
            elif is_ref_partial:
                status = "PARTIAL"
                note = "Partially corroborated by reference answer; conveys consistent meaning with minor stylistic or detail variance."
                evidence_text = f"Reference Ground Truth: {reference_answer}"
                source = "Reference Answer"
                sim_float = round(best_score, 4)
                confidence = round(0.70 + (best_score - 0.58) * 0.5, 2)
                relevance_pct = min(100, max(0, int(best_score * 100)))
                partial += 1
            elif best_chunk is not None:
                sim_float = round(best_score, 4)
                relevance_pct = min(100, max(0, int(best_score * 100)))
                source = best_chunk.source_name
                evidence_text = (
                    best_chunk.content[:220] + "…"
                    if len(best_chunk.content) > 220
                    else best_chunk.content
                )

                # Check for year clash against best chunk content
                if _detect_year_clash(sentence, best_chunk.content):
                    status = "INCORRECT"
                    note = f"Contains conflicting factual details (dates/numerical mismatch) compared to {best_chunk.source_name}."
                    confidence = 0.88
                    incorrect += 1
                elif _detect_polarity_clash(sentence, best_chunk.content):
                    status = "CONTRADICTED"
                    note = f"Directly conflicts with verified {best_chunk.source_name} evidence."
                    confidence = 0.90
                    contradicted += 1
                elif best_score >= _SUPPORTED_THRESHOLD:
                    status = "SUPPORTED"
                    note = "Directly corroborated by retrieved knowledge base evidence."
                    confidence = min(0.98, max(0.80, round(best_score, 2)))
                    supported += 1
                elif best_score >= _PARTIAL_THRESHOLD:
                    s_words = set(re.findall(r"\b[a-zA-Z0-9]{3,}\b", sentence.lower())) - _STOPWORDS_ACC
                    b_words = set(re.findall(r"\b[a-zA-Z0-9]{3,}\b", best_chunk.content.lower())) - _STOPWORDS_ACC
                    if (s_words & b_words) or best_score >= 0.72:
                        status = "PARTIAL"
                        note = "Partially supported; related evidence found but with minor discrepancy."
                        confidence = round(0.65 + (best_score - _PARTIAL_THRESHOLD), 2)
                        partial += 1
                    else:
                        status = "UNSUPPORTED"
                        note = "Claim could not be sufficiently verified from available knowledge base evidence."
                        confidence = min(0.90, max(0.70, round(1.0 - best_score, 2)))
                        unsupported += 1
                else:
                    status = "UNSUPPORTED"
                    note = "Claim could not be verified from available evidence in the knowledge base."
                    confidence = min(0.90, max(0.70, round(1.0 - best_score, 2)))
                    unsupported += 1
            else:
                # No evidence and no reference answer
                status = "UNSUPPORTED"
                evidence_text = "No corroborating reference evidence retrieved from available knowledge base."
                source = "VeriAI KB"
                relevance_pct = 0
                sim_float = 0.0
                confidence = 0.50
                note = "Claim could not be verified due to lack of reference evidence in the knowledge base."
                unsupported += 1

            claims.append(ClaimResult(
                claim=sentence,
                status=status,
                evidence_text=evidence_text,
                source=source,
                relevance=relevance_pct,
                note=note,
                similarity=sim_float,
                confidence=confidence,
            ))

        total = len(claims)
        if total == 0:
            accuracy_score = 0
        else:
            # Weighted accuracy:
            # SUPPORTED = 1.0, PARTIAL = 0.5, UNSUPPORTED = 0.0, INCORRECT = 0.0, CONTRADICTED = 0.0
            weighted = (
                supported * 1.0
                + partial * 0.5
                + unsupported * 0.0
                + incorrect * 0.0
                + contradicted * 0.0
            ) / total

            if contradicted > 0 or incorrect > 0:
                weighted = min(weighted, 0.20)

            accuracy_score = min(100, max(0, int(weighted * 100)))

        # ── Explanatory Reasoning ──────────────────────────────────────────────
        ground_source = "reference ground truth" if has_ref else "retrieved RAG knowledge chunks"
        discrepancy_count = contradicted + incorrect

        if accuracy_score >= 80:
            status = "Verified Correct"
            reasoning = (
                f"High accuracy score ({accuracy_score}/100). All or most factual claims ({supported}/{total}) "
                f"are verified and SUPPORTED by the {ground_source} with strong semantic corroboration."
            )
        elif accuracy_score >= 50:
            status = "Partially Correct"
            reasoning = (
                f"Moderate accuracy score ({accuracy_score}/100). The response contains {supported} SUPPORTED and "
                f"{partial} PARTIAL claim(s), but has {unsupported} UNSUPPORTED claim(s) lacking direct grounding."
            )
        elif discrepancy_count > 0:
            status = "Factual Inaccuracies Detected"
            reasoning = (
                f"Low accuracy score ({accuracy_score}/100) due to factual discrepancy. Found {discrepancy_count} "
                f"CONTRADICTED/INCORRECT claim(s) directly conflicting with {ground_source}."
            )
        else:
            status = "Unverified Assertions"
            reasoning = (
                f"Low accuracy score ({accuracy_score}/100). Out of {total} claims, {unsupported} were UNSUPPORTED "
                f"with no matching corroboration in {ground_source}."
            )

        return AccuracyResult(
            claims=claims,
            accuracy_score=accuracy_score,
            supported_count=supported,
            partial_count=partial,
            unsupported_count=unsupported,
            contradicted_count=contradicted,
            incorrect_count=incorrect,
            reasoning=reasoning,
            status=status,
        )

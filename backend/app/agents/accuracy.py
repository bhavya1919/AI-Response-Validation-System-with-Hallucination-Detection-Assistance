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
    Splits text into atomic factual claims, decomposing compound coordination
    (e.g. 'The Taj Mahal is in Agra and was built in 1900.') while preserving abbreviations.
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

    # Sentence boundary split
    raw_sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9])', masked.strip())

    claims: List[str] = []
    for s in raw_sentences:
        parts = [p.strip() for p in s.split(';') if p.strip()]
        for p in parts:
            # Decompose coordinate conjunctions with clauses/verbs, but preserve simple noun lists
            subparts = re.split(
                r'(?:,\s*|\s+)(?:although|even though|whereas)\s+(?=(?:it|its|their|they|he|his|she|her|this|that|the|a|an|some|most|all|was|is|are|were|has|have|had)\b)|,\s*(?:and|but|however|while|though)\s+(?=(?:it|its|their|they|he|his|she|her|this|that|the|a|an|some|most|all|was|is|are|were|has|have|had)\b)|\s+(?:and|but)\s+(?=(?:it|they|he|she|this|that|was|is|are|were|has|have|had)\b)',
                p,
                flags=re.IGNORECASE
            )
            for sp in subparts:
                for ph, ab in placeholders:
                    sp = sp.replace(ph, ab)
                sp = sp.strip().rstrip('.')
                if sp:
                    claims.append(sp)

    return claims if claims else [text.strip()]


def _cosine_sim(a: List[float], b: List[float]) -> float:
    """Dot product of two already-normalized BGE unit vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    return max(0.0, min(1.0, sum(x * y for x, y in zip(a, b))))


def _detect_polarity_clash(claim: str, reference: str, ref_sim: float = 0.0) -> bool:
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

    # High semantic similarity indicates affirmative semantic alignment, not polarity contradiction
    if ref_sim >= 0.75:
        return False

    # Check for direct antonym / negative assertion contradiction
    neg_tokens = {"not", "nothing", "nobody", "none", "cannot", "incapable", "never", "false", "uninhabited", "impossible"}

    def _has_negative_assertion(text: str) -> bool:
        t_clean = re.sub(r'\bwith\s+no\b', '', text.lower())
        if any(re.search(rf'\b{tok}\b', t_clean) for tok in neg_tokens):
            return True
        if re.search(r'\bno\s+(?:longer|more|one|body|thing|such|evidence|human|person|people)\b', t_clean):
            return True
        if re.search(r'\b(?:is|are|was|were|do|does|did|can|could|will|would|has|have|had)\s+(?:no|not|never)\b|\bn\'t\b', t_clean):
            return True
        return False

    c_neg = _has_negative_assertion(c_low)
    r_neg = _has_negative_assertion(r_low)

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
    "on", "at", "by", "from", "up", "out", "as", "into", "through", "then",
    "called", "known", "stands", "means", "located", "symbol", "commonly", "primarily",
    "responsible", "used", "uses", "using", "use", "consists", "consisting", "defined",
    "refers", "referring", "stated", "expressed", "represented", "instrument"
})

_SYNONYM_PAIRS = [
    {"produce", "produced", "producing", "synthesize", "synthesized", "synthesizing", "create", "created", "make", "made"},
    {"sequence", "set", "series", "collection", "order", "chain"},
    {"solve", "solving", "solution", "resolve"},
    {"computation", "calculation", "compute", "calculate", "computing"},
    {"write", "writes", "wrote", "written", "writing", "author", "authored"},
    {"pump", "pumps", "pumping"},
    {"measure", "measures", "measuring", "measurement"},
    {"equal", "equals", "equaling", "="},
    {"yen", "jpy"},
    {"exposed", "exposure", "response", "responding"},
    {"unique", "uniquely"},
    {"identifier", "identifies", "identifying", "identification"},
    {"formula", "equation", "representation"},
    {"database", "table", "relational", "relation", "schema"},
    {"inhale", "inhales", "inhaling", "breathe", "breathes", "breathing", "respiration"},
    {"cell", "cells", "cellular"},
    {"british", "britain", "uk", "kingdom", "united kingdom", "england", "english"},
    {"american", "america", "united states", "usa", "us"},
    {"earth", "world", "globe"},
    {"day", "days"},
    {"led", "lead", "leader", "prime", "minister", "premier", "ruled", "governed"},
    {"war", "world war"},
    {"delivery", "delivers", "delivered", "transmission", "transmitting"},
    {"services", "service", "power", "resources"},
    {"prioritizes", "prioritize", "optimizes", "optimize", "focuses", "focus"},
    {"speed", "fast", "low-latency", "latency", "quick"},
    {"demand", "on-demand", "pay-as-you-go"},
]

_MUTUALLY_EXCLUSIVE_TERMS = [
    # Computer science & systems concepts
    ({"stack", "stacks"}, {"queue", "queues"}),
    ({"compiler", "compilers"}, {"interpreter", "interpreters"}),
    ({"tcp"}, {"udp"}),
    ({"ram"}, {"rom"}),
    ({"bfs", "breadth-first"}, {"dfs", "depth-first"}),
    ({"symmetric"}, {"asymmetric"}),
    # Science & Biology
    ({"prokaryote", "prokaryotes", "prokaryotic"}, {"eukaryote", "eukaryotes", "eukaryotic"}),
    ({"dna"}, {"rna"}),
    ({"mitosis"}, {"meiosis"}),
    ({"acid", "acidic"}, {"base", "basic", "alkaline"}),
    ({"exothermic"}, {"endothermic"}),
    ({"cation", "cations"}, {"anion", "anions"}),
    # Quantitative & Directional Antonyms
    ({"increase", "increases", "increasing", "increased", "rise", "rises", "rising", "grow", "growth"},
     {"decrease", "decreases", "decreasing", "decreased", "drop", "drops", "fall", "falls", "decline", "declines"}),
    ({"eliminate", "eliminates", "eliminated", "eliminating", "without"},
     {"cost", "costs", "requiring", "requires", "trade-off", "tradeoff", "expense"}),
    ({"minimum", "min", "least"}, {"maximum", "max", "most"}),
    ({"positive"}, {"negative"}),
    ({"true"}, {"false"}),
    ({"input"}, {"output"}),
    ({"internal"}, {"external"}),
]

def _detect_antonym_clash(claim: str, reference: str) -> Tuple[bool, str]:
    """Detects when claim and reference assert mutually exclusive opposing concepts."""
    c_words = set(re.findall(r"\b\w+\b", claim.lower()))
    r_words = set(re.findall(r"\b\w+\b", reference.lower()))
    for grp_a, grp_b in _MUTUALLY_EXCLUSIVE_TERMS:
        has_a_c = bool(c_words & grp_a)
        has_b_c = bool(c_words & grp_b)
        has_a_r = bool(r_words & grp_a)
        has_b_r = bool(r_words & grp_b)
        if (has_a_c and not has_b_c and has_b_r and not has_a_r) or (has_b_c and not has_a_c and has_a_r and not has_b_r):
            shared = (c_words & r_words) - (grp_a | grp_b) - _STOPWORDS_ACC
            if shared or len(c_words & r_words) >= 2:
                c_tok = list(c_words & (grp_a | grp_b))[0]
                r_tok = list(r_words & (grp_a | grp_b))[0]
                return True, f"Mutually contradictory concepts: asserted '{c_tok}' conflicting with reference '{r_tok}'"

    # Also detect directional noun opposition (e.g. 'quantity demanded increases' vs 'demand decreases')
    grp_inc = {"increase", "increases", "increasing", "increased", "rise", "rises", "rising", "grow", "growth"}
    grp_dec = {"decrease", "decreases", "decreasing", "decreased", "drop", "drops", "fall", "falls", "decline", "declines"}
    c_tokens = re.findall(r"\b\w+\b", claim.lower())
    r_tokens = re.findall(r"\b\w+\b", reference.lower())

    def _get_dir_associations(tokens):
        assoc = {}
        for i, tok in enumerate(tokens):
            d = 'INC' if tok in grp_inc else ('DEC' if tok in grp_dec else None)
            if d:
                for j in range(max(0, i - 4), min(len(tokens), i + 5)):
                    if j != i:
                        w = tokens[j]
                        if w not in _STOPWORDS_ACC and len(w) >= 3 and w not in grp_inc and w not in grp_dec:
                            assoc.setdefault(_stem_word(w), set()).add(d)
        return assoc

    c_assoc = _get_dir_associations(c_tokens)
    r_assoc = _get_dir_associations(r_tokens)
    for noun, c_dirs in c_assoc.items():
        if noun in r_assoc:
            r_dirs = r_assoc[noun]
            if ('INC' in c_dirs and 'DEC' in r_dirs and 'DEC' not in c_dirs) or ('DEC' in c_dirs and 'INC' in r_dirs and 'INC' not in c_dirs):
                c_opp = "increase/rise" if 'INC' in c_dirs else "decrease/fall"
                r_opp = "decrease/fall" if 'INC' in c_dirs else "increase/rise"
                return True, f"Opposing direction asserted for '{noun}': asserted {c_opp} while reference specifies {r_opp}"

    # Detect inverted comparative relations (e.g. 'faster in air than in water' vs 'faster in water than in air')
    comp_pat = r'\b(faster|slower|higher|lower|greater|smaller|more|less|quicker|hotter|colder|larger|denser|heavier|lighter)\s+(?:in|than|at)?\s*([a-zA-Z]+)\s+than\s+(?:in\s+)?([a-zA-Z]+)\b'
    m_c = re.search(comp_pat, claim.lower())
    m_r = re.search(comp_pat, reference.lower())
    if m_c and m_r:
        comp_c, x_c, y_c = m_c.group(1), m_c.group(2), m_c.group(3)
        comp_r, x_r, y_r = m_r.group(1), m_r.group(2), m_r.group(3)
        if comp_c == comp_r and x_c == y_r and y_c == x_r:
            return True, f"Inverted comparative relationship: asserted '{comp_c} in {x_c} than {y_c}' conflicting with reference '{comp_r} in {x_r} than {y_r}'"

    return False, ""

def _stem_word(w: str) -> str:
    w = w.lower().strip(".,()[]{}'\"")
    if len(w) > 4:
        if w.endswith("ing"): return w[:-3]
        if w.endswith("tion"): return w[:-4]
        if w.endswith("ed"): return w[:-2]
        if w.endswith("es"): return w[:-2]
        if w.endswith("s") and not w.endswith("ss"): return w[:-1]
        if w.endswith("ly"): return w[:-2]
    return w

def _are_terms_equivalent(w1: str, w2: str) -> bool:
    s1, s2 = _stem_word(w1), _stem_word(w2)
    if s1 == s2:
        return True
    if len(s1) >= 4 and len(s2) >= 4 and (s1.startswith(s2) or s2.startswith(s1)):
        return True
    w1_low, w2_low = w1.lower(), w2.lower()
    for group in _SYNONYM_PAIRS:
        if (w1_low in group or s1 in group) and (w2_low in group or s2 in group):
            return True
    return False

_NUM_WORDS_ACC = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
    'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10', 'eleven': '11', 'twelve': '12'
}


def _extract_content_tokens(text: str) -> List[str]:
    # Compound common terms like Vitamin C, Vitamin D, Type 1
    text = re.sub(r'\b(vitamin|type|phase|class|stage|factor)\s+([a-zA-Z0-9])\b', r'\1_\2', text, flags=re.IGNORECASE)
    tokens = re.findall(r'\b[a-zA-Z0-9_\-\.\^/]{1,}\b', text.lower())
    return [t for t in tokens if t not in _STOPWORDS_ACC]


def _extract_numbers(text: str) -> Set[str]:
    # Strip thousands separators between digits (e.g. 6,650 -> 6650, 299,792,458 -> 299792458)
    clean_text = re.sub(r'(?<=\d),(?=\d)', '', text)
    nums = set(re.findall(r'\b\d+(?:\.\d+)?\b', clean_text.lower()))
    for w, n in _NUM_WORDS_ACC.items():
        if re.search(rf'\b{w}\b', clean_text.lower()):
            nums.add(n)
    return nums


def _detect_numerical_clash(claim: str, reference: str) -> Tuple[bool, str]:
    """Detects when claim asserts conflicting numbers/quantities compared to reference."""
    c_nums = _extract_numbers(claim)
    r_nums = _extract_numbers(reference)
    diff_c = c_nums - r_nums
    diff_r = r_nums - c_nums

    # Filter out numbers that are prefixes / unit conversions (e.g. 299792 vs 299792458 km vs m)
    unmatched_c = set()
    for c in diff_c:
        matched = False
        for r in diff_r:
            if r.startswith(c) or c.startswith(r):
                matched = True
                break
        if not matched:
            unmatched_c.add(c)

    unmatched_r = set()
    for r in diff_r:
        matched = False
        for c in diff_c:
            if r.startswith(c) or c.startswith(r):
                matched = True
                break
        if not matched:
            unmatched_r.add(r)

    if unmatched_c and unmatched_r:
        return True, f"Numerical discrepancy: asserted {sorted(list(unmatched_c))} vs reference {sorted(list(unmatched_r))}"
    return False, ""


# ── Generic vocabulary that should NEVER trigger clash detection ──
# These are common verbs, adjectives, connectors that differ between paraphrases
_GENERIC_VOCAB = frozenset({
    # connectors / transitional words
    "whereas", "while", "although", "however", "therefore", "furthermore", "thus",
    "also", "both", "each", "every", "all", "some", "many", "most", "any", "other",
    "another", "very", "more", "just", "such", "primarily", "mainly", "generally",
    "typically", "commonly", "usually", "specifically", "particularly",
    # generic verbs commonly used in paraphrasing
    "provides", "prioritizes", "identifies", "discovers", "leads", "causes",
    "uses", "allows", "enables", "helps", "makes", "creates", "gives", "takes",
    "known", "called", "named", "said", "stated", "found", "used", "based",
    "offers", "focuses", "requires", "involves", "includes", "contains", "shows",
    "performs", "operates", "functions", "works", "acts", "serves", "employs",
    "converts", "transforms", "generates", "produces", "synthesizes", "stores",
    # generic adjectives / descriptors
    "fast", "slow", "quick", "reliable", "stable", "efficient", "simple", "complex",
    "strong", "weak", "high", "low", "large", "small", "big", "new", "old", "modern",
    "traditional", "common", "rare", "special", "specific", "general", "global",
    "local", "internal", "external", "primary", "secondary", "major", "minor",
    "absolute", "relative", "direct", "indirect", "active", "passive", "public",
    # technical generic nouns (not specific named entities)
    "condition", "destruction", "process", "mechanism", "system", "method", "approach",
    "technique", "procedure", "model", "algorithm", "protocol", "framework", "structure",
    "delivery", "transmission", "connection", "datagram", "packet", "signal",
    "response", "request", "result", "output", "input", "data", "information",
    "leading", "causing", "severe", "attacks", "destroys", "immune", "body", "which",
    "immediately", "celebrated", "module", "groupings", "targets", "discovers",
    "algorithms", "models", "without", "labels", "labeled", "unlabeled",
    "absolute", "whereas", "provides", "while", "fast", "delivery", "transmission",
    # common English common nouns that appear capitalized only as part of compound names
    # or as sentence starters — must NOT be treated as specific named entities
    "name", "names", "like", "united", "great", "new", "old", "young",
    "system", "systems", "service", "services", "standard", "standards",
    "readable", "numerical", "network", "networks",
    "decisions", "decision", "regarding", "levels", "level", "action", "actions",
})


def _is_specific_named_entity(token: str, source_text: str) -> bool:
    """Returns True only for proper nouns / specific named entities that can be
    uniquely identified as carrying factual weight (city names, people, specific
    technical terms, acronyms, chemical symbols, etc.)."""
    if token.lower() in _GENERIC_VOCAB:
        return False
    # Compound tokens like vitamin_c, type_1
    if "_" in token:
        return True
    # Check capitalized occurrence in source text
    matches = list(re.finditer(rf'\b{re.escape(token)}\b', source_text, re.IGNORECASE))
    for m in matches:
        val = m.group(0)
        if val[0].isupper():
            if len(token) == 2:
                return True
            if m.start() > 0 or len(token) >= 3:
                return True
    return False


def _detect_factual_clash(claim: str, reference: str, ref_sim: float = 0.0, question: str = "") -> Tuple[bool, str]:
    """
    Detects when a claim substitutes key factual entities, proper nouns, or specific
    named terms with incorrect or alien terms (e.g. 'New Delhi' vs 'Agra', 'Lyon' vs 'Paris',
    'carbon dioxide' vs 'water', 'Utility' vs 'Unit').

    IMPORTANT: This function ONLY fires when BOTH sides have specific named entities / proper
    nouns that differ. It does NOT fire for paraphrased answers that use different vocabulary
    but convey the same meaning. Generic vocabulary differences (different adjectives, verbs,
    connectors) do NOT constitute a factual clash.
    """
    if ref_sim >= 0.98:
        return False, ""

    c_norm = claim.replace("=", " equals ")
    r_norm = reference.replace("=", " equals ")
    q_norm = (question or "").replace("=", " equals ")

    c_tokens = _extract_content_tokens(c_norm)
    r_tokens = _extract_content_tokens(r_norm)
    q_tokens = _extract_content_tokens(q_norm)

    conversational = {'answer', 'fact', 'correct', 'actual', 'location', 'country', 'continent', 'city', 'state'}

    c_entities = [
        ct for ct in c_tokens
        if ct not in conversational and ct not in q_tokens
        and not any(_are_terms_equivalent(ct, rt) for rt in r_tokens)
        and _is_specific_named_entity(ct, c_norm)
        and len(ct) >= 2
    ]

    r_entities = [
        rt for rt in r_tokens
        if rt not in conversational and rt not in q_tokens
        and not any(_are_terms_equivalent(rt, ct) for ct in c_tokens)
        and _is_specific_named_entity(rt, r_norm)
        and len(rt) >= 2
    ]

    # ONLY trigger when both sides have specific named entities that differ
    # AND the claim shares some content words with the reference (same topic).
    # If the claim has zero shared content with the reference, it's a new independent
    # claim about a different aspect → UNSUPPORTED, not CONTRADICTED.
    if c_entities and r_entities:
        c_all = set(_extract_content_tokens(c_norm))
        r_all = set(_extract_content_tokens(r_norm))
        shared_content = c_all & r_all
        if shared_content:
            extra_str = ', '.join(sorted(set(c_entities)))
            ref_str = ', '.join(sorted(set(r_entities)))
            return True, f"Factual term substitution: asserted '{extra_str}' conflicting with reference '{ref_str}'"

    return False, ""


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
        question: Optional[str] = None,
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
        ref_sentences: List[str] = []
        ref_sent_vecs: List[List[float]] = []
        has_ref = bool(reference_answer and reference_answer.strip())
        if has_ref:
            ref_vec = embedding_service.embed_text(reference_answer.strip())
            ref_sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', reference_answer.strip()) if s.strip()]
            if len(ref_sentences) > 1:
                ref_sent_vecs = embedding_service.embed_documents(ref_sentences)

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
            clash_detail = ""

            # ── Check 1: Direct comparison against reference answer (highest authority) ──
            if ref_vec is not None and reference_answer:
                ref_sim_full = _cosine_sim(claim_vec, ref_vec)
                best_ref_sent_sim = max([_cosine_sim(claim_vec, sv) for sv in ref_sent_vecs], default=0.0)
                ref_sim = max(ref_sim_full, best_ref_sent_sim)
                s_low = sentence.lower().strip()
                r_low = reference_answer.lower().strip()

                num_clash, num_reason = _detect_numerical_clash(sentence, reference_answer)
                fact_clash, fact_reason = _detect_factual_clash(sentence, reference_answer, ref_sim=ref_sim, question=question or "")
                year_clash = _detect_year_clash(sentence, reference_answer)
                pol_clash = _detect_polarity_clash(sentence, reference_answer, ref_sim=ref_sim)
                antonym_clash, antonym_reason = _detect_antonym_clash(sentence, reference_answer)

                if num_clash:
                    is_contradiction = True
                    best_score = 0.20
                    clash_detail = num_reason
                elif fact_clash:
                    is_contradiction = True
                    best_score = 0.20
                    clash_detail = fact_reason
                elif antonym_clash:
                    is_contradiction = True
                    best_score = 0.20
                    clash_detail = antonym_reason
                elif year_clash:
                    is_incorrect = True
                    best_score = 0.30
                    clash_detail = "Conflicting year/date discrepancy relative to reference."
                elif pol_clash:
                    is_contradiction = True
                    best_score = 0.15
                    clash_detail = "Direct polarity contradiction (affirmative vs negative)."
                elif (
                    ref_sim >= 0.82
                    or (len(r_low) >= 4 and r_low in s_low)
                    or (len(s_low) >= 4 and s_low in r_low)
                    or (s_low in ("no.", "yes.", "no", "yes") and r_low.startswith(s_low.rstrip(".")))
                ):
                    best_score = max(ref_sim, 0.95)
                    is_ref_match = True
                elif ref_sim >= 0.65:
                    # Check if the claim omits key named entities / core tokens from the reference
                    r_tokens = _extract_content_tokens(reference_answer)
                    c_tokens = _extract_content_tokens(sentence)
                    conversational = {'answer', 'fact', 'correct', 'actual', 'location', 'country', 'continent', 'city', 'state'}
                    missing_core = [
                        rt for rt in r_tokens
                        if rt not in conversational and not any(_are_terms_equivalent(rt, ct) for ct in c_tokens)
                    ]
                    alien_tokens = [
                        ct for ct in c_tokens
                        if ct not in conversational and ct not in _GENERIC_VOCAB and not any(_are_terms_equivalent(ct, rt) for rt in r_tokens)
                    ]
                    # If claim introduces substantive alien assertions with no grounding in reference,
                    # do not mark as fully corroborated by reference — mark as partial
                    if len(alien_tokens) >= 3 and (len(alien_tokens) / max(1, len(c_tokens))) >= 0.65:
                        best_score = ref_sim
                        is_ref_partial = True
                    elif len(missing_core) >= 3 or (len(r_tokens) >= 3 and len(c_tokens) / len(r_tokens) < 0.40):
                        best_score = max(ref_sim, 0.70)
                        is_ref_partial = True
                        clash_detail = f"Partially corroborated; omits key detail(s): {', '.join(sorted(set(missing_core)))}"
                    else:
                        best_score = max(ref_sim, 0.95)
                        is_ref_match = True
                elif ref_sim >= 0.55:
                    r_tokens = _extract_content_tokens(reference_answer)
                    c_tokens = _extract_content_tokens(sentence)
                    conversational = {'answer', 'fact', 'correct', 'actual', 'location', 'country', 'continent', 'city', 'state'}
                    alien_tokens = [
                        ct for ct in c_tokens
                        if ct not in conversational and ct not in _GENERIC_VOCAB and not any(_are_terms_equivalent(ct, rt) for rt in r_tokens)
                    ]
                    if len(alien_tokens) >= 3 and (len(alien_tokens) / max(1, len(c_tokens))) >= 0.50:
                        best_score = ref_sim
                    elif any(_are_terms_equivalent(rt, ct) for rt in r_tokens for ct in c_tokens):
                        best_score = ref_sim
                        is_ref_partial = True
                    else:
                        best_score = ref_sim
                else:
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
                note = clash_detail or "Directly contradicts the verified reference ground truth."
                evidence_text = f"Reference Ground Truth: {reference_answer}"
                source = "Reference Answer"
                sim_float = round(best_score, 4)
                confidence = 0.95
                relevance_pct = max(0, int(best_score * 100))
                contradicted += 1
            elif is_incorrect:
                status = "INCORRECT"
                note = clash_detail or "Contains factual inaccuracies (date or entity discrepancy) relative to reference ground truth."
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
                note = "Partially corroborated by reference answer; conveys consistent meaning with minor detail variance."
                evidence_text = f"Reference Ground Truth: {reference_answer}"
                source = "Reference Answer"
                sim_float = round(best_score, 4)
                confidence = round(0.70 + (best_score - 0.50) * 0.5, 2)
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

                chunk_num_clash, c_num_r = _detect_numerical_clash(sentence, best_chunk.content)
                chunk_fact_clash, c_fact_r = _detect_factual_clash(sentence, best_chunk.content)

                if chunk_num_clash:
                    status = "CONTRADICTED"
                    note = f"Conflicting numerical details compared to {best_chunk.source_name}: {c_num_r}"
                    confidence = 0.92
                    contradicted += 1
                elif chunk_fact_clash:
                    status = "CONTRADICTED"
                    note = f"Conflicting factual assertions compared to {best_chunk.source_name}: {c_fact_r}"
                    confidence = 0.90
                    contradicted += 1
                elif _detect_year_clash(sentence, best_chunk.content):
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

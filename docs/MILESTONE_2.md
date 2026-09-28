# VeriAI — Milestone 2: Multi-Agent Evaluation System

## Overview

This document describes the complete implementation of VeriAI's **Milestone 2** requirements.
VeriAI is a multi-agent AI response evaluation platform that combines semantic retrieval,
judge-based scoring, hallucination detection, and structured verdict synthesis to determine
the factual quality of AI-generated answers.

---

## M2.1 — Relevance Judge Agent

**File:** `backend/app/agents/relevance.py`  
**Class:** `RelevanceJudgeAgent`

### Responsibility
Evaluate whether the AI response directly and substantively addresses the submitted question.

### Signal Pipeline (5 Combined Signals)
| Signal | Weight | Description |
|--------|--------|-------------|
| Semantic embedding similarity | Primary | Cosine similarity between BGE-small-en-v1.5 embeddings of question ↔ response |
| Keyword / concept coverage | 40% blend | Fraction of non-stopword question terms appearing in response |
| Retrieved evidence alignment | Boost (+0.06–+0.12) | Max cosine similarity of response against top-5 evidence chunks |
| Reference answer corroboration | Override | When reference is provided, drives composite score |
| Evasion detection | Gate | Regex patterns identify non-answers; short evasions capped at score 15 |

### Score → Label Mapping
| Score Range | Label |
|-------------|-------|
| 90–100 | `fully_relevant` |
| 70–89 | `mostly_relevant` |
| 50–69 | `partially_relevant` |
| 25–49 | `mostly_irrelevant` |
| 0–24 | `completely_irrelevant` |

### Output Schema (`RelevanceResult`)
```python
@dataclass
class RelevanceResult:
    score: int       # 0–100
    label: str       # one of the 5 labels above
    reasoning: str   # human-readable explanation including semantic sim, keyword coverage
```

### Example Output
```json
{
  "score": 94,
  "label": "fully_relevant",
  "reasoning": "The response directly and comprehensively answers the question with closely matched topical content. Semantic alignment score is 0.87 with 100% key inquiry term coverage (5/5 question concepts addressed)."
}
```

---

## M2.2 — Accuracy Judge Agent

**File:** `backend/app/agents/accuracy.py`  
**Class:** `AccuracyAgent`

### Responsibility
Decompose the AI response into individual factual claims and verify each against the
retrieved knowledge base and/or reference answer.

### Pipeline
1. **Sentence segmentation** — split response into individual claims via regex + heuristics
2. **Embedding each claim** — BGE-small-en-v1.5 via `EmbeddingService`
3. **Reference comparison** — if `reference_answer` provided, cosine similarity + partial text match
4. **Evidence pool comparison** — compare claim against top retrieved chunks
5. **Claim classification** — based on best similarity score

### Claim Status Classification
| Status | Threshold | Meaning |
|--------|-----------|---------|
| `SUPPORTED` | sim ≥ 0.78 | Claim is corroborated by evidence |
| `PARTIAL` | sim ≥ 0.60 | Claim is partially supported |
| `INCORRECT` | sim < 0.60 + contradicted semantics | Claim contradicts evidence |
| `CONTRADICTED` | negative semantic match | Claim directly opposes evidence |
| `UNSUPPORTED` | sim < 0.55 + no match | No evidence found for claim |

### Output Schema (`AccuracyResult`)
```python
@dataclass
class AccuracyResult:
    claims: List[ClaimResult]   # per-claim breakdown
    accuracy_score: int         # 0–100 weighted score
    reasoning: str
    supporting_evidence: str
    supported_count: int
    partial_count: int
    unsupported_count: int
    contradicted_count: int
```

### Scoring Formula
```
accuracy_score = (supported * 1.0 + partial * 0.5) / total_claims × 100
```
Contradicted claims apply a penalty multiplier.

---

## M2.3 — Hallucination Detection Agent

**File:** `backend/app/agents/hallucination.py`  
**Class:** `HallucinationAgent`

### Responsibility
Identify claims in the AI response that are unsupported, contradicted, or fabricated
relative to the retrieved evidence and reference ground truth.

### Input
- `AccuracyResult` — claim-level verdict from M2.2
- `List[EvidenceChunk]` — retrieved evidence from RetrieverAgent
- `ai_response` — original text for additional heuristics
- `evidence_status` — retrieval quality signal (`"strong"` / `"moderate"` / `"weak"`)

### Detection Logic
1. All claims with status `UNSUPPORTED`, `CONTRADICTED`, or `INCORRECT` from AccuracyAgent are flagged
2. Each flagged claim receives a structured `FlaggedClaim` with `reasoning` and `evidence`
3. Risk score is computed from the ratio of flagged claims, weighted by evidence quality

### Risk Score → Status
| Risk Score | Status |
|------------|--------|
| 0–14 | `low` |
| 15–34 | `moderate` |
| 35–59 | `high` |
| 60–100 | `critical` |

### Output Schema (`HallucinationResult`)
```python
@dataclass
class HallucinationResult:
    status: str                          # "low" | "moderate" | "high" | "critical"
    risk_score: int                      # 0–100
    reasoning: str
    flagged_claims: List[FlaggedClaim]
    contradiction_detected: bool
    contradiction_note: str
    evidence_sufficiency_note: str
```

### FlaggedClaim Structure
```python
@dataclass
class FlaggedClaim:
    claim: str
    status: str      # "UNSUPPORTED" | "CONTRADICTED" | "HALLUCINATED"
    reasoning: str   # WHY this claim is flagged
    evidence: str    # Best-matching evidence that contradicts/lacks support
```

---

## M2.4 — Orchestrator: Agent Evaluation & Consistency Validation

**File:** `backend/app/api/evaluate.py`  
**Endpoint:** `POST /api/evaluate`

### Architecture
```
POST /api/evaluate
  │
  ├── Step 1: RetrieverAgent (evidence fetched ONCE from pgvector)
  │
  ├── Step 2: Three Judge Agents (parallel evaluation context)
  │   ├── RelevanceJudgeAgent  (M2.1)
  │   ├── AccuracyAgent        (M2.2)
  │   └── HallucinationAgent   (M2.3)
  │
  ├── Step 3: VerdictAgent — synthesize final score, label, reasoning
  │
  └── Step 4: PostgreSQL persistence (Evaluation + Claims + Evidence tables)
```

### Consistency Validation
- Evidence is retrieved **exactly once** and shared across all three judges
- The `AccuracyResult` output is passed directly into `HallucinationAgent`, ensuring consistency — hallucination detection never contradicts accuracy scoring
- The `VerdictAgent` synthesizes all three outputs into a single overall score

### Orchestration Code (Simplified)
```python
retriever_result = RetrieverAgent().run(db, question, ai_response, top_k)
relevance_result = RelevanceJudgeAgent().run(question, ai_response, evidence, reference_answer)
accuracy_result  = AccuracyAgent().run(ai_response, evidence, reference_answer)
hallucination_result = HallucinationAgent().run(accuracy_result, evidence, ai_response, ...)
verdict_result   = VerdictAgent().run(question, ai_response, retriever_result, accuracy_result,
                                      hallucination_result, reference_answer, relevance_result)
```

---

## M2.5 — Structured Evaluation Result

The `POST /api/evaluate` response is a fully typed `EvaluateResponse` Pydantic model that includes:

```json
{
  "id": "eval-abc12345",
  "question": "...",
  "aiResponse": "...",
  "referenceAnswer": "...",
  "overallScore": 82,
  "verdict": "PASS",
  "confidence": "high",
  "scores": {
    "relevance": 94,
    "accuracy": 81,
    "hallucinationRisk": 12,
    "completeness": 78
  },
  "claims": [...],
  "reasons": [...],
  "evidence": [...],
  "relevance": {
    "score": 94,
    "label": "fully_relevant",
    "reasoning": "..."
  },
  "accuracy": {
    "score": 81,
    "reasoning": "...",
    "claims": [{ "claim": "...", "status": "SUPPORTED", "similarity": 0.91, "evidence": "..." }]
  },
  "hallucination": {
    "risk_score": 12,
    "status": "low",
    "reasoning": "...",
    "flagged_claims": []
  },
  "completeness": {
    "score": 78,
    "reasoning": "..."
  },
  "verdict_detail": {
    "overall_score": 82,
    "label": "PASS",
    "reasoning": "..."
  }
}
```

---

## M2.6 — Agent Testing & Validation

### Test Files

| File | Tests | Coverage |
|------|-------|---------|
| `backend/tests/test_evaluation_pipeline.py` | 10 | Full pipeline: correct, incorrect, hallucinated, partial, contradictory, irrelevant, empty, multi-claim, missing reference |
| `backend/tests/test_knowledge_base.py` | 7 | KB health, source lifecycle, ingest, batch, deduplication, dataset filtering, stats |
| `backend/tests/test_relevance_agent.py` | 3 | Individual relevance categories, logical score ordering, edge cases (empty/evasion) |

**Total: 20 tests — 20 passed ✅**

### Running Tests
```bash
# From c:\2 info
$env:PYTHONPATH = "c:\2 info"
python -m pytest backend/tests/ -v
```

### Individual Relevance Agent Tests (`test_relevance_agent.py`)

| Test | Description |
|------|-------------|
| `test_relevance_individual_categories` | Validates score range and label for 5 relevance tiers |
| `test_relevance_logical_ordering` | Verifies fully_relevant >> completely_irrelevant by ≥65 points |
| `test_relevance_empty_and_evasion_responses` | Edge cases: empty string → score 0, evasive reply → score ≤20 |

---

## M2.7 — Knowledge Base & Benchmark Datasets

### Integrated Datasets

| Dataset | Documents | Chunks | Type |
|---------|-----------|--------|------|
| SQuAD v1.1 | ~500 | ~1,000 | Reading comprehension QA |
| TruthfulQA | ~400 | ~800 | Factual truthfulness benchmark |
| General KB | ~100 | ~266 | Custom domain documents |
| **Total** | **~1,001** | **~2,066** | |

### Embedding Model
- **Model:** `BAAI/bge-small-en-v1.5`
- **Dimensions:** 384
- **Storage:** pgvector extension on PostgreSQL 15+
- **Index type:** IVFFlat (cosine distance)

### Vector Search
```sql
SELECT *, embedding <=> query_vec AS distance
FROM knowledge_chunks
ORDER BY distance
LIMIT top_k;
```

---

## M2.8 — Retriever Agent

**File:** `backend/app/agents/retriever.py`  
**Class:** `RetrieverAgent`

- Accepts `question` + `ai_response` and embeds both
- Performs pgvector similarity search across `KnowledgeChunk` table
- Supports optional `dataset` filter (`"squad"`, `"truthfulqa"`, `"all"`)
- Returns `RetrieverResult` with `evidence: List[EvidenceChunk]` and `evidence_status`
- Evidence status: `"strong"` (avg sim ≥ 0.75), `"moderate"`, `"weak"` (avg sim < 0.50)

---

## M2.9 — Verdict Agent

**File:** `backend/app/agents/verdict.py`  
**Class:** `VerdictAgent`

Synthesizes all judge outputs into a final verdict:

| Verdict | Condition |
|---------|-----------|
| `PASS` | Overall score ≥ 70 AND hallucination risk < 35 |
| `REVIEW` | Overall score 50–69 OR hallucination risk 35–59 |
| `FAIL` | Overall score < 50 OR hallucination risk ≥ 60 |

### Score Weighting
```
overall_score = (accuracy × 0.40) + (relevance × 0.30) + (completeness × 0.20) + (100 - hallucination_risk) × 0.10
```

---

## M2.10 — Database Persistence

**Files:** `backend/app/db/models.py`, `backend/app/db/session.py`

### Tables

| Table | Description |
|-------|-------------|
| `evaluations` | One row per evaluation — scores, verdict, confidence, metadata |
| `evaluation_claims` | Per-claim results (status, similarity, evidence, note) |
| `evaluation_evidence` | Retrieved evidence chunks used in evaluation |
| `knowledge_sources` | Named KB sources (SQuAD, TruthfulQA, etc.) |
| `knowledge_documents` | Documents within each source |
| `knowledge_chunks` | Chunked text with pgvector embeddings |

### Engine Configuration
```python
# Synchronous engine for compatibility with pytest and FastAPI dependency injection
engine = create_engine(settings.sync_database_url, pool_size=5, max_overflow=10)
```

---

## M2.11 — API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/evaluate` | Run full multi-agent evaluation |
| `GET` | `/api/evaluate/history` | List all evaluations with filtering |
| `GET` | `/api/evaluate/stats/dashboard` | Aggregate KPIs for dashboard |
| `GET` | `/api/evaluate/{id}` | Fetch single evaluation by ID |
| `DELETE` | `/api/evaluate/{id}` | Delete evaluation record |
| `GET` | `/api/knowledge/sources` | List KB sources |
| `POST` | `/api/knowledge/ingest` | Ingest new documents |
| `GET` | `/api/knowledge/search` | Semantic search |
| `GET` | `/api/knowledge/ingest/stats` | Ingestion statistics |

---

## M2.12 — Frontend Integration

**Framework:** React 18 + TypeScript + Vite (port 3000)

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | JWT authentication |
| Dashboard | `/dashboard` | KPI cards, verdict distribution, recent evaluations |
| Evaluate | `/evaluate` | Evaluation form with claim-level results, evidence panel |
| History | `/history` | Searchable, filterable evaluation history |
| Knowledge Base | `/knowledge` | Source management, document ingestion |

All M2 structured outputs (`relevance`, `accuracy`, `hallucination`, `verdict_detail`) are consumed by the Evaluate page to render:
- Per-agent score cards
- Claim-by-claim status badges (`SUPPORTED` / `PARTIAL` / `UNSUPPORTED` / `CONTRADICTED`)
- Hallucination risk indicator
- Evidence source panel with chunk content

---

## M2.13 — System Health & Running Status

### Services
| Service | Address | Status |
|---------|---------|--------|
| FastAPI backend | `http://localhost:8000` | ✅ Running |
| React frontend | `http://localhost:3000` | ✅ Running |
| PostgreSQL | `localhost:5432` | ✅ Running |
| pgvector | Extension active | ✅ Version 0.8.6 |

### Startup Commands
```powershell
# PostgreSQL
& "c:\2 info\pgsql\bin\postgres.exe" -D "c:\2 info\pgsql\data"

# Backend (from c:\2 info)
$env:PYTHONPATH = "c:\2 info"
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000

# Frontend (from c:\2 info\client)
npm run dev
```

### API Interactive Docs
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Summary Compliance Matrix

| Milestone Requirement | Status | Implementation |
|-----------------------|--------|---------------|
| M2.1 Relevance Judge Agent | ✅ | `agents/relevance.py` — 5-signal pipeline, 5 labels, reasoning |
| M2.2 Accuracy Judge Agent | ✅ | `agents/accuracy.py` — claim decomposition, 5 statuses, similarity |
| M2.3 Hallucination Detection Agent | ✅ | `agents/hallucination.py` — FlaggedClaim, 4-tier risk, reasoning |
| M2.4 Orchestrator / Consistency | ✅ | `api/evaluate.py` — single retrieval pass, shared context |
| M2.5 Structured Result | ✅ | `EvaluateResponse` Pydantic model with all judge outputs |
| M2.6 Agent Tests | ✅ | 20 tests passing across 3 test files |
| M2.7 Benchmark Datasets | ✅ | SQuAD + TruthfulQA + General KB (2,066 chunks) |
| M2.8 Retriever Agent | ✅ | `agents/retriever.py` — pgvector cosine search |
| M2.9 Verdict Agent | ✅ | `agents/verdict.py` — weighted synthesis, PASS/REVIEW/FAIL |
| M2.10 DB Persistence | ✅ | PostgreSQL, 3 evaluation tables, sync engine |
| M2.11 REST API | ✅ | 5 evaluate endpoints + 4 knowledge endpoints |
| M2.12 Frontend | ✅ | React + TypeScript, all M2 fields consumed |
| M2.13 System Health | ✅ | All 3 services running, pgvector active |

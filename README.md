# VeriAI — AI Response Validation with Hallucination Detection

VeriAI is a web platform that checks whether an AI-generated answer can be trusted. It compares the answer against a knowledge base using semantic retrieval, then runs it through a multi-agent evaluation pipeline that scores relevance, accuracy, hallucination risk and completeness, and returns a weighted final verdict: `PASS`, `REVIEW` or `FAIL`.

**Live application:** [https://veriai-iota.vercel.app](https://veriai-iota.vercel.app)
**Repository:** [AI-Response-Validation-System-with-Hallucination-Detection-Assistance](https://github.com/bhavya1919/AI-Response-Validation-System-with-Hallucination-Detection-Assistance)

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Production Architecture](#production-architecture)
- [Technology Stack](#technology-stack)
- [Evaluation Components](#evaluation-components)
- [Scoring Model](#scoring-model)
- [Retrieval and Knowledge Base](#retrieval-and-knowledge-base)
- [Inspect: Full Evaluation Details](#inspect-full-evaluation-details)
- [Single Evaluation](#single-evaluation)
- [Batch CSV Evaluation](#batch-csv-evaluation)
- [Exports](#exports)
- [Application Pages](#application-pages)
- [API Reference](#api-reference)
- [Database](#database)
- [Testing and Benchmarks](#testing-and-benchmarks)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Security](#security)
- [Deployment Workflow](#deployment-workflow)
- [Project Structure](#project-structure)
- [Limitations](#limitations)
- [Verification Status](#verification-status)

---

## Overview

**What it is.** An end-to-end system for validating AI-generated responses.

**The problem.** AI answers can be fluent but wrong, unsupported by evidence, off-topic or incomplete. A single similarity score cannot tell these failures apart.

**How an answer is evaluated.** The user submits a question and an AI response, and optionally a reference answer or a custom source document. The system retrieves supporting evidence from the knowledge base, and five evaluation agents examine the response from different angles. Their outputs are combined into a final score and verdict.

**Why retrieval is used.** Judging a response against retrieved ground-truth evidence, rather than against the evaluator's own knowledge, lets each claim be marked as supported, unsupported or contradicted and lets the result show the evidence behind it.

**Retriever vs. agents.** The **Retriever** is not an evaluation agent. It finds evidence. The **five evaluation agents** are:

1. Relevance Agent
2. Accuracy Agent
3. Hallucination Detection Agent
4. Completeness Agent
5. Final Verdict Agent

**What the verdict means.**

| Verdict | Meaning |
| :-- | :-- |
| `PASS` | The weighted multi-agent result indicates an acceptable response |
| `REVIEW` | The result is borderline or mixed and needs human review |
| `FAIL` | The weighted result indicates an unacceptable response |

---

## System Architecture

```mermaid
flowchart TD
    U[User] --> FE[React + TypeScript frontend<br/>built with Vite]
    FE -->|Axios REST| API[FastAPI backend]

    subgraph Ingestion[Knowledge-base ingestion]
        SRC[Dataset / document] --> CH[Chunking]
        CH --> EMB1[Embedding]
        EMB1 --> VDB
    end

    API --> ORCH[Evaluation orchestrator]
    ORCH --> RET[Retriever]
    RET --> EMB2[FastEmbed<br/>BAAI/bge-small-en-v1.5<br/>384-D]
    EMB2 --> VDB[(PostgreSQL + pgvector)]
    VDB --> EVID[Retrieved evidence]

    EVID --> AGENTS
    subgraph AGENTS[Evaluation agents]
        REL[Relevance]
        ACC[Accuracy]
        HAL[Hallucination Detection]
        COM[Completeness]
    end
    AGENTS --> VER[Final Verdict Agent]
    VER --> RES[Score + PASS / REVIEW / FAIL]
    RES --> DB[(PostgreSQL persistence)]

    DB --> DASH[Dashboard]
    DB --> HIST[History]
    DB --> REP[Reports]
    DB --> INS[Inspect]
    DB --> PDF[PDF export - ReportLab]
    DB --> CSV[CSV export]

    BATCH[Batch CSV upload] --> API
```

The four analysis agents feed the Verdict Agent. This document does not make any claim about whether they execute in parallel or in sequence.

---

## Production Architecture

```mermaid
flowchart TD
    GH[GitHub main] --> V[Vercel]
    V -->|/*| SPA[React + Vite static frontend<br/>build output: dist/]
    V -->|/api/*| FA[FastAPI Python serverless backend]
    FA --> NEON[(Neon PostgreSQL)]
    NEON --> PGV[pgvector]
```

| Item | Detail |
| :-- | :-- |
| Frontend | Static Vite SPA, build output in `dist/` (`dist/index.html`) |
| Backend | FastAPI running as a Python serverless function on Vercel |
| Routing | `/api/*` goes to the FastAPI backend; every other path goes to the React/Vite frontend |
| Database | Neon PostgreSQL with the `pgvector` extension |
| Configuration files | `vercel.json` (routing/build configuration) and `backend/api/index.py` (serverless entry point for the FastAPI app) |
| Secrets | Configured in the Vercel project environment; never stored in the repository |

Production must use a cloud database connection. `127.0.0.1` / `localhost` database URLs are for local development only.

---

## Technology Stack

| Category | Technology |
| :-- | :-- |
| Frontend | React 19, TypeScript, Vite, Axios |
| Backend | Python, FastAPI, SQLAlchemy (async, `asyncpg` driver) |
| Database | PostgreSQL, `pgvector`; Neon PostgreSQL in production |
| AI / RAG | FastEmbed, `BAAI/bge-small-en-v1.5`, 384-dimensional embeddings, semantic vector search |
| File processing | ReportLab (PDF), CSV import/export |
| Testing | pytest (backend), TypeScript type checking (`pnpm run check`) |
| Deployment | Vercel, Neon, GitHub |

Package versions other than React 19 are defined in `package.json` and the backend requirements file.

---

## Evaluation Components

| Component | Input | Responsibility | Output |
| :-- | :-- | :-- | :-- |
| Retriever | Question | Embeds the question and searches the knowledge base (FastEmbed + pgvector) | Retrieved evidence / context |
| Relevance Agent | Question, response, retrieved context | Judges whether the response addresses the question | Score, label, reasoning, retrieved context, supporting evidence |
| Accuracy Agent | Response, evidence, optional reference answer | Evaluates the claims made in the response | Score, claims evaluated, supported claims, incorrect/contradicting claims, evidence, reasoning |
| Hallucination Detection Agent | Response, evidence | Classifies each claim as `SUPPORTED`, `UNSUPPORTED` or `CONTRADICTED` | Hallucination risk/score, flagged claims, classifications, reasons, evidence, reasoning |
| Completeness Agent | Question, response, evidence, optional reference answer | Compares what the response covers with what was expected | Score, label, expected information, missing information, reasoning |
| Final Verdict Agent | Outputs of the four agents above | Combines the outputs using fixed weights | Final score, verdict, weighted scoring information, reasoning, summary |

---

## Scoring Model

The verdict comes from the combined agent outputs, not from a single metric. The scoring logic lives in the backend Verdict Agent and is shared by single and batch evaluations.

| Dimension | Weight |
| :-- | :--: |
| Accuracy | 40% |
| Relevance | 30% |
| Completeness | 15% |
| Hallucination risk (penalty) | 15% |

```text
Final Score = 0.40 × Accuracy
            + 0.30 × Relevance
            + 0.15 × Completeness
            + 0.15 × (inverse of Hallucination Risk)
```

Hallucination is a risk measure, so higher risk lowers the final score. The exact thresholds that map a final score to `PASS`, `REVIEW` and `FAIL` are defined in the Verdict Agent source code.

---

## Retrieval and Knowledge Base

```text
Question → Embedding → Vector search (pgvector) → Retrieved context → Evaluation agents
```

| Item | Value |
| :-- | :-- |
| Embedding library | FastEmbed |
| Embedding model | `BAAI/bge-small-en-v1.5` |
| Vector dimension | 384 |
| Vector store | PostgreSQL with `pgvector` |

Knowledge is organised as sources, documents and chunks. Each chunk has an embedding used for semantic search. The knowledge base is managed from the Knowledge Base page (`/knowledge-base`).

Knowledge-base data (documents, chunks, embeddings) is separate from the evaluation datasets: the 50-question benchmark and the 25-question unseen set are used to test the evaluation pipeline, not to populate the knowledge base.

---

## Inspect: Full Evaluation Details

Any evaluation listed in History, Reports or Dashboard can be inspected individually.

```text
Evaluation row → Inspect → Evaluation ID → GET /api/evaluate/{id} → Complete evaluation → Detail view
```

The detail view shows:

- **Overview:** evaluation ID, date/time, question, AI response, reference answer (when provided), source document (when provided), dataset / knowledge base used, retrieved evidence (when available)
- **Relevance:** agent name, score, label, reasoning, retrieved context, supporting evidence
- **Accuracy:** score, claims evaluated, supported claims, incorrect/contradicting claims, supporting evidence, reasoning
- **Hallucination:** risk/score, flagged claims, claim classifications, reasons, supporting or contradicting evidence, reasoning
- **Completeness:** score, label, expected information, missing information, reasoning
- **Final verdict:** final score, verdict, weighted scoring information, reasoning, summary

Optional or unavailable information is shown as **No data available** instead of breaking the view.

---

## Single Evaluation

```text
Question + AI Response + optional Reference Answer / Source Document
        ↓
Retriever → evidence
        ↓
Evaluation agents → Final Verdict Agent
        ↓
Persisted to PostgreSQL
        ↓
Result shown in the UI (available later in History, Dashboard, Reports and Inspect)
```

Route: `/evaluate`. A PDF report of a single evaluation can be exported (see [Exports](#exports)).

---

## Batch CSV Evaluation

```text
CSV upload → parsing → column validation → preview → batch creation
→ row-by-row evaluation → multi-agent pipeline → persistence
→ batch summary → History / Dashboard / Reports
```

Example structure:

```csv
question,ai_response,reference_answer
"What is photosynthesis?","Photosynthesis is the process by which plants convert light energy into chemical energy.","Photosynthesis converts light energy into chemical energy."
```

Required fields are enforced by the batch API validation. Reference answers and custom source documents can be supplied as optional fields. Individual row failures must not silently invalidate rows that were processed successfully. Route: `/batch`.

---

## Exports

| Export | Endpoint | Contents |
| :-- | :-- | :-- |
| Single evaluation PDF | `GET /api/evaluate/{id}/export-pdf` | Metadata, question, AI response, reference answer, relevance/accuracy/hallucination/completeness results, claims, evidence, agent explanations, final score, verdict, recommendations |
| Batch PDF | `GET /api/evaluate/batch/{batch_id}/export-pdf` | Batch metadata, evaluation count, PASS/REVIEW/FAIL distribution, aggregate scores, agent statistics, individual evaluation summaries |
| CSV export | — | Evaluation ID, question, AI response, relevance, accuracy, hallucination score/risk, completeness, final score, verdict, timestamp; valid CSV escaping and Unicode preserved |

PDFs are generated with ReportLab.

---

## Application Pages

| Page | Route | Purpose |
| :-- | :-- | :-- |
| Dashboard | `/dashboard` | Evaluation KPIs, charts and recent activity |
| Evaluate | `/evaluate` | Single AI-response evaluation |
| Batch Evaluation | `/batch` | CSV-based multi-evaluation |
| History | `/history` | Previous evaluation records, with Inspect |
| Knowledge Base | `/knowledge-base` | Dataset and document management |
| Analytics | `/analytics` | Evaluation analytics and visualizations |
| Reports | `/reports` | Evaluation reports and exports |
| Architecture | `/architecture` | System architecture visualization |
| Documentation | `/docs` | Platform documentation |
| Settings | `/settings` | User and system configuration |

---

## API Reference

All paths are served under `/api`.

### Health

| Method | Path | Purpose |
| :-- | :-- | :-- |
| GET | `/api/health` | Backend health check |

### Evaluation

| Method | Path | Purpose |
| :-- | :-- | :-- |
| POST | `/api/evaluate` | Run a single evaluation |
| GET | `/api/evaluate/{id}` | Full evaluation details (used by Inspect) |

### History and Statistics

| Method | Path | Purpose |
| :-- | :-- | :-- |
| GET | `/api/evaluate/history` | List previous evaluations |
| GET | `/api/evaluate/stats/dashboard` | Dashboard statistics |

### Batch Evaluation

| Method | Path | Purpose |
| :-- | :-- | :-- |
| POST | `/api/evaluate/batch` | Run a batch evaluation |

### PDF Export

| Method | Path | Purpose |
| :-- | :-- | :-- |
| GET | `/api/evaluate/{id}/export-pdf` | Single evaluation PDF |
| GET | `/api/evaluate/batch/{batch_id}/export-pdf` | Batch PDF |

### Knowledge Base

| Method | Path | Purpose |
| :-- | :-- | :-- |
| GET | `/api/knowledge/ingest/stats` | Knowledge-base ingestion statistics |

---

## Database

Production uses Neon PostgreSQL with the `pgvector` extension.

| Table | Purpose |
| :-- | :-- |
| `knowledge_sources` | Dataset / source information |
| `knowledge_documents` | Documents belonging to sources |
| `knowledge_chunks` | Text chunks with embeddings |
| `evaluations` | Evaluation records and scores |
| `evaluation_claims` | Claim-level results |
| `evaluation_evidence` | Evidence attached to evaluations |

When Inspect is opened, the backend loads the evaluation by ID together with its claims and evidence and returns them as one complete evaluation object.

---

## Testing and Benchmarks

| Asset | Purpose | Command |
| :-- | :-- | :-- |
| Backend tests | Automated backend tests | `pytest backend/tests/ -v` |
| Type checking | Frontend TypeScript check | `pnpm run check` |
| Production build | Vite build | `pnpm run build` |
| `data/m4_benchmark_50.csv` | Official 50-question benchmark covering correct, incorrect, hallucinated, incomplete and contradicted responses | `python run_benchmark_validation.py` |
| `data/unseen_validation_25.csv` | Unseen validation set | `python run_unseen_validation.py` |

The benchmark uses the repository's official questions and reference data; expected answers are not changed to improve results. Each benchmark run can record the question, AI response, reference answer, retrieved evidence, the four agent scores, final score, verdict and any errors.

Every test case in the evaluation matrix (correct, partial, incorrect, hallucinated, incomplete, irrelevant, ambiguous, empty/invalid input, long response, multiple claims, knowledge-base supported, knowledge-base contradiction, no matching evidence, multi-hop, custom reference answer, custom source document) goes through the same multi-agent pipeline.

Pass counts and benchmark scores are not stated here. Run the commands above to produce current results.

---

## Local Development

**Prerequisites:** Node.js with pnpm, Python, and a PostgreSQL database with the `pgvector` extension.

```bash
# Frontend
pnpm install
pnpm dev
pnpm run check
pnpm run build
```

```bash
# Backend tests
pytest backend/tests/ -v
```

Create a local environment file from the variables below, using a local database. Local values must never be used as the production configuration.

---

## Environment Variables

| Variable | Purpose | Local example |
| :-- | :-- | :-- |
| `DATABASE_URL` | Async PostgreSQL connection string | `postgresql+asyncpg://postgres:your_password@127.0.0.1:5432/veriai` |
| `EMBEDDING_MODEL` | Embedding model name | `BAAI/bge-small-en-v1.5` |
| `VECTOR_DIMENSION` | Embedding vector size | `384` |
| `LLM_PROVIDER` | LLM provider setting | `mock` |
| `LLM_API_KEY` | API key for the provider | `your_api_key_here` |
| `LLM_MODEL` | Model name for the provider | `claude-sonnet-4-6` |
| `VITE_API_URL` | Backend URL used by the frontend in local development | `http://localhost:8000` |

Production values are configured in the Vercel project environment, and `DATABASE_URL` in production must point to the Neon database. The values above are placeholders.

---

## Security

- Secrets and API keys are never committed to GitHub.
- Production secrets live in Vercel environment variables.
- API keys and database credentials stay on the server side and are not exposed to the frontend.
- Local `127.0.0.1` / `localhost` database URLs are not used for production.

---

## Deployment Workflow

```text
Developer → Git → GitHub main → Vercel → production build
   → static frontend (dist/) + FastAPI serverless backend → Neon PostgreSQL
```

Every production deployment should originate from the verified GitHub `main` branch.

---

## Project Structure

```text
.
├── client/                          React + Vite frontend
├── backend/
│   ├── api/index.py                 Serverless entry point for FastAPI
│   └── tests/                       Backend tests
├── data/
│   ├── m4_benchmark_50.csv          50-question benchmark
│   └── unseen_validation_25.csv     Unseen validation set
├── run_benchmark_validation.py      Benchmark runner
├── run_unseen_validation.py         Unseen-set runner
├── package.json                     Frontend scripts and dependencies
└── vercel.json                      Vercel routing/build configuration
```

---

## Limitations

- Retrieval quality depends on knowledge-base coverage.
- Hallucination detection depends on the evidence available for the question.
- External LLM providers require configuration.
- Serverless environments have runtime and resource limits.
- Benchmark performance does not guarantee correct results on every unseen domain.

---

## Verification Status

A feature counts as verified only after its full workflow (frontend → API → backend → database → response → UI) has been exercised. The Inspect workflow must be verified separately from the History/Reports summary table.

| Area | Status | Evidence |
| :-- | :-- | :-- |
| Frontend build | NOT VERIFIED | Not run during this documentation update |
| TypeScript | NOT VERIFIED | Not run during this documentation update |
| Backend tests | NOT VERIFIED | Not run during this documentation update |
| Database | NOT VERIFIED | Not checked |
| Knowledge base | NOT VERIFIED | Not checked |
| Single evaluation | NOT VERIFIED | Not run |
| Batch evaluation | NOT VERIFIED | Not run |
| Inspect | NOT VERIFIED | Not run |
| Dashboard | NOT VERIFIED | Not run |
| History | NOT VERIFIED | Not run |
| Reports | NOT VERIFIED | Not run |
| PDF export | NOT VERIFIED | Not run |
| CSV upload | NOT VERIFIED | Not run |
| Production API | NOT VERIFIED | Not called |
| Production frontend | NOT VERIFIED | Not loaded |

Update this table with real results after running the commands in [Testing and Benchmarks](#testing-and-benchmarks) and the production smoke checks.

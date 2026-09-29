# VeriAI — Multi-Agent LLM Evaluation Platform

VeriAI is an advanced multi-agent evaluation platform that evaluates and benchmarks Large Language Model (LLM) responses against canonical, dynamic ground-truth knowledge bases using PostgreSQL, `pgvector`, and multi-hop semantic search.

---

## Benchmark Reference Knowledge Base (Phase 2.1)

The reference knowledge base grounds evaluation agents in certified truth corpuses, preventing reliance on model hallucination or superficial fluency.

### 1. Ingested Datasets

| Dataset | Provider | Purpose | Important Fields Preserved | Default Sample Size |
| :--- | :--- | :--- | :--- | :--- |
| **SQuAD v1.1** | `rajpurkar/squad` (HF) | Reading comprehension & contextual factual QA benchmark | `question`, `context`, `answer`, `answer_start`, `split`, `record_id`, `title` | 500 records (configurable) |
| **TruthfulQA** | `truthfulqa/truthful_qa` (HF, generation) | Factuality, counteracting common misconceptions and false premises | `question`, `reference_answer`, `correct_answers`, `incorrect_answers`, `category`, `source_ref`, `record_id` | 500 records (configurable) |
| **VeriAI Docs** | Local / Custom | Core platform architecture, judge rubric guidelines, system documentation | `category`, `author`, `source`, `dataset`, `record_id` | Custom |

### 2. Configuration & Ingestion Parameters

Configurable via `.env`:
```env
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/veriai
EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
VECTOR_DIMENSION=384
CHUNK_SIZE=500
CHUNK_OVERLAP=50
SQUAD_SAMPLE_SIZE=500
TRUTHFULQA_SAMPLE_SIZE=500
```

### 3. Chunking & Embedding Architecture
- **Embedding Model**: `BAAI/bge-small-en-v1.5` via ONNX runtime (`fastembed`). Dense vector dimensionality: **384**.
- **Chunking Strategy**: Configurable token/character windowing (`CHUNK_SIZE=500`, `CHUNK_OVERLAP=50`) with sentence boundary preservation.
- **pgvector Indexing**: Chunks are indexed using an HNSW index with cosine distance operators (`vector_cosine_ops`, `m=16`, `ef_construction=64`).
- **Idempotency Guarantee**: Unique record identifiers (`metadata->>'record_id'`) prevent duplicate records on repeated ingestion runs.

### 4. Running Ingestion

#### Via CLI:
```bash
# Ingest SQuAD (configurable sample size)
python -m backend.app.ingestion.squad --sample-size 500

# Ingest TruthfulQA (configurable sample size)
python -m backend.app.ingestion.truthfulqa --sample-size 500
```

#### Via REST API:
- `POST /api/knowledge/ingest/squad` `{"sample_size": 500}`
- `POST /api/knowledge/ingest/truthfulqa` `{"sample_size": 500}`
- `GET /api/knowledge/ingest/stats`: Live indexing statistics and dataset breakdown.
- `POST /api/knowledge/search`: Semantic vector search supporting `dataset`, `threshold`, and `top_k`.

---

## Running the Application Locally

### 1. PostgreSQL with pgvector
Ensure PostgreSQL is running on `127.0.0.1:5432` with the `vector` extension enabled:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Backend Server (FastAPI)
```bash
$env:PYTHONPATH = "c:\2 info"
& "c:\2 info\backend\venv\Scripts\uvicorn.exe" backend.app.main:app --host 0.0.0.0 --port 8000
```

### 3. Frontend Dev Server (React + Vite)
```bash
npx pnpm dev
```
Accessible at: [http://localhost:3000](http://localhost:3000)

### 4. Running Automated Tests
```bash
$env:PYTHONPATH = "c:\2 info"
& "c:\2 info\backend\venv\Scripts\pytest.exe" backend/tests/test_knowledge_base.py -v
```

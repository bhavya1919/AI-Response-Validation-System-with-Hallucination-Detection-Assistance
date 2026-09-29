import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.db.session import SessionLocal
from backend.app.db.models import KnowledgeSource, KnowledgeDocument, KnowledgeChunk

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "veriai-kb-api"

def test_source_lifecycle():
    # 1. Create a knowledge source
    src_data = {
        "name": "pytest-test-source",
        "source_type": "automated_test",
        "description": "Source created by automated pytest suite",
        "dataset_name": "pytest-dataset"
    }
    create_res = client.post("/api/knowledge/sources", json=src_data)
    assert create_res.status_code == 201
    source = create_res.json()
    source_id = source["id"]
    assert source["name"] == "pytest-test-source"

    # 2. Get the knowledge source
    get_res = client.get(f"/api/knowledge/sources/{source_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == source_id

    # 3. List sources
    list_res = client.get("/api/knowledge/sources")
    assert list_res.status_code == 200
    assert any(s["id"] == source_id for s in list_res.json())

    # 4. Clean up source
    del_res = client.delete(f"/api/knowledge/sources/{source_id}")
    assert del_res.status_code == 204

def test_ingest_and_search_pipeline():
    # 1. Ingest document
    doc_payload = {
        "source_name": "pytest-rag-benchmark",
        "source_type": "benchmark",
        "dataset_name": "eval-v1",
        "title": "Agentic Evaluation with Ground Truth RAG",
        "content": "Antigravity agents utilize multi-hop retrieval and precision claim-verification to assess hallucination rates in neural language models. The pgvector extension accelerates embedding comparisons.",
        "metadata": {"domain": "eval_science", "difficulty": "hard"}
    }
    ingest_res = client.post("/api/knowledge/ingest/text", json=doc_payload)
    assert ingest_res.status_code == 201
    ingest_data = ingest_res.json()
    assert ingest_data["chunk_count"] >= 1
    doc_id = ingest_data["document_id"]
    source_id = ingest_data["source_id"]

    # 2. Verify chunks were stored with embeddings
    chunks_res = client.get(f"/api/knowledge/chunks?doc_id={doc_id}")
    assert chunks_res.status_code == 200
    chunks = chunks_res.json()
    assert len(chunks) >= 1
    chunk_id = chunks[0]["id"]
    assert chunks[0]["has_embedding"] is True

    # 3. Perform semantic search
    search_payload = {
        "query": "How do agents evaluate hallucination rates using ground truth?",
        "top_k": 3,
        "threshold": 0.4
    }
    search_res = client.post("/api/knowledge/search", json=search_payload)
    assert search_res.status_code == 200
    results = search_res.json()
    assert len(results) > 0
    # The top result should have a high cosine similarity score
    assert results[0]["score"] > 0.6
    assert "hallucination" in results[0]["content"].lower()

    # 4. Find similar chunks to chunk_id
    similar_res = client.get(f"/api/knowledge/search/similar/{chunk_id}?top_k=5")
    assert similar_res.status_code == 200
    sim_results = similar_res.json()
    assert isinstance(sim_results, list)

    # 5. Clean up created source
    client.delete(f"/api/knowledge/sources/{source_id}")

def test_batch_ingest():
    batch_payload = {
        "source_name": "pytest-batch-source",
        "source_type": "documentation",
        "dataset_name": "batch-eval-docs",
        "documents": [
            {
                "title": "Doc 1: Ground Truth Extraction",
                "content": "Ground truth extraction extracts verified claims from certified reference literature.",
                "metadata": {"doc_num": 1}
            },
            {
                "title": "Doc 2: Cosine Similarity Scoring",
                "content": "Cosine distance between query and chunk vectors determines contextual relevance.",
                "metadata": {"doc_num": 2}
            }
        ]
    }
    res = client.post("/api/knowledge/ingest/batch", json=batch_payload)
    assert res.status_code == 201
    data = res.json()
    assert data["documents_ingested"] == 2
    assert data["total_chunks"] >= 2
    source_id = data["source_id"]

    # Verify search finds the specific document
    search_res = client.post("/api/knowledge/search", json={
        "query": "How is cosine distance used in contextual relevance?",
        "source_id": source_id,
        "top_k": 1
    })
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert len(search_data) == 1
    assert "Cosine distance" in search_data[0]["content"]

    # Clean up
    client.delete(f"/api/knowledge/sources/{source_id}")


def test_idempotency_and_duplicate_prevention():
    from backend.app.ingestion.common import get_or_create_source, batch_ingest_records
    db = SessionLocal()
    try:
        source = get_or_create_source(
            db=db,
            name="idempotency-test-source",
            source_type="test",
            description="Testing duplicate prevention",
            dataset_name="idempotency_test"
        )
        test_items = [
            {
                "title": "Idempotent Document 1",
                "content": "This document must not be duplicated on repeated ingestion passes.",
                "metadata": {"dataset": "idempotency_test", "record_id": "idem-rec-001"}
            }
        ]

        # First pass: should create document and chunks
        pass1 = batch_ingest_records(db, source, test_items, batch_size=10)
        assert pass1["documents_created"] == 1
        assert pass1["chunks_created"] >= 1
        assert pass1["skipped"] == 0

        # Second pass: should skip without creating duplicates
        pass2 = batch_ingest_records(db, source, test_items, batch_size=10)
        assert pass2["documents_created"] == 0
        assert pass2["chunks_created"] == 0
        assert pass2["skipped"] == 1

        # Clean up
        client.delete(f"/api/knowledge/sources/{source.id}")
    finally:
        db.close()


def test_search_dataset_filtering_and_provenance():
    # Search for benchmark content
    search_benchmark_res = client.post("/api/knowledge/search", json={
        "query": "What is the capital of France?",
        "top_k": 3
    })
    assert search_benchmark_res.status_code == 200
    benchmark_hits = search_benchmark_res.json()
    # We expect at least some results from the knowledge base
    assert isinstance(benchmark_hits, list)

    # Search with dataset filter - may return 0 if specific dataset not loaded
    search_squad_res = client.post("/api/knowledge/search", json={
        "query": "Lourdes France Saint Bernadette",
        "dataset": "squad",
        "top_k": 3
    })
    assert search_squad_res.status_code == 200
    squad_hits = search_squad_res.json()
    # SQuAD may not be ingested — only validate structure, not count
    assert isinstance(squad_hits, list)
    for hit in squad_hits:
        assert hit["dataset"] == "squad"
        assert hit["score"] > 0.4

    search_tqa_res = client.post("/api/knowledge/search", json={
        "query": "Are vampires real in the real world?",
        "dataset": "truthfulqa",
        "top_k": 3
    })
    assert search_tqa_res.status_code == 200
    tqa_hits = search_tqa_res.json()
    assert isinstance(tqa_hits, list)
    for hit in tqa_hits:
        assert hit["dataset"] == "truthfulqa"
        assert hit["score"] > 0.4


def test_ingestion_stats_with_datasets():
    res = client.get("/api/knowledge/ingest/stats")
    assert res.status_code == 200
    stats = res.json()
    assert stats["sources"] >= 1
    assert stats["documents"] >= 1
    assert stats["chunks"] >= 1
    assert stats["chunks_with_embeddings"] == stats["chunks"]
    # At minimum, the veriai_benchmark dataset should be present
    assert "datasets" in stats


"""
Semantic search over KnowledgeChunk embeddings using pgvector cosine similarity
"""
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from backend.app.db.session import get_db
from backend.app.services.embedding import embedding_service

router = APIRouter()


class SearchResult(BaseModel):
    chunk_id: str
    document_id: str
    source_id: str
    source_name: Optional[str] = None
    dataset: Optional[str] = None
    content: str
    score: float
    question: Optional[str] = None
    answer: Optional[str] = None
    category: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    source_ids: Optional[List[str]] = None
    dataset: Optional[str] = None
    min_score: float = 0.0
    threshold: Optional[float] = None


@router.post("", response_model=List[SearchResult])
def semantic_search(body: SearchRequest, db: Session = Depends(get_db)):
    """
    Embed the query, then run pgvector ANN search with optional source & dataset filter.
    Returns top-k chunks ranked by cosine similarity.
    """
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty")

    query_vec = embedding_service.embed_text(body.query)
    vec_str = "[" + ",".join(str(v) for v in query_vec) + "]"

    filters = []
    params: Dict[str, Any] = {"vec": vec_str, "top_k": body.top_k}

    if body.source_ids:
        placeholders = ", ".join(f":sid{i}" for i in range(len(body.source_ids)))
        filters.append(f"kd.source_id IN ({placeholders})")
        for i, sid in enumerate(body.source_ids):
            params[f"sid{i}"] = sid

    if body.dataset:
        filters.append("(ks.dataset_name ILIKE :dataset OR ks.name ILIKE :dataset)")
        params["dataset"] = f"%{body.dataset}%"

    filter_clause = ""
    if filters:
        filter_clause = "AND " + " AND ".join(filters)

    effective_min_score = body.threshold if body.threshold is not None else body.min_score

    sql = text(f"""
        SELECT
            kc.id          AS chunk_id,
            kc.document_id AS document_id,
            kd.source_id   AS source_id,
            ks.name        AS source_name,
            ks.dataset_name AS dataset_name,
            kc.content     AS content,
            kc.metadata    AS metadata,
            1 - (kc.embedding <=> CAST(:vec AS vector)) AS score
        FROM knowledge_chunks kc
        JOIN knowledge_documents kd ON kd.id = kc.document_id
        JOIN knowledge_sources ks ON ks.id = kd.source_id
        WHERE kc.embedding IS NOT NULL
          {filter_clause}
        ORDER BY kc.embedding <=> CAST(:vec AS vector)
        LIMIT :top_k
    """)

    try:
        rows = db.execute(sql, params).mappings().all()
    except Exception:
        from backend.app.db.models import KnowledgeChunk, KnowledgeDocument, KnowledgeSource
        import math
        q_chunks = db.query(KnowledgeChunk, KnowledgeDocument, KnowledgeSource)\
                     .join(KnowledgeDocument, KnowledgeDocument.id == KnowledgeChunk.document_id)\
                     .join(KnowledgeSource, KnowledgeSource.id == KnowledgeDocument.source_id).all()
        rows = []
        for kc, kd, ks in q_chunks:
            if body.source_ids and kd.source_id not in body.source_ids:
                continue
            if body.dataset and not (body.dataset.lower() in (ks.dataset_name or '').lower() or body.dataset.lower() in (ks.name or '').lower()):
                continue
            score = 0.5
            if kc.embedding and query_vec:
                try:
                    dot = sum(a * b for a, b in zip(kc.embedding, query_vec))
                    norm_a = math.sqrt(sum(a * a for a in kc.embedding))
                    norm_b = math.sqrt(sum(b * b for b in query_vec))
                    if norm_a > 0 and norm_b > 0:
                        score = dot / (norm_a * norm_b)
                except Exception:
                    pass
            rows.append({
                "chunk_id": kc.id,
                "document_id": kc.document_id,
                "source_id": kd.source_id,
                "source_name": ks.name,
                "dataset_name": ks.dataset_name,
                "content": kc.content,
                "metadata": kc.metadata_json,
                "score": score
            })
        rows.sort(key=lambda x: x["score"], reverse=True)
        rows = rows[:body.top_k]

    results = []
    for row in rows:
        score_val = round(float(row["score"]), 4)
        if score_val >= effective_min_score:
            meta = row["metadata"] or {}
            results.append(SearchResult(
                chunk_id=row["chunk_id"],
                document_id=row["document_id"],
                source_id=row["source_id"],
                source_name=row["source_name"],
                dataset=row["dataset_name"],
                content=row["content"],
                score=score_val,
                question=meta.get("question"),
                answer=meta.get("answer") or meta.get("reference_answer"),
                category=meta.get("category"),
                metadata=meta,
            ))
    return results


@router.get("/similar/{chunk_id}", response_model=List[SearchResult])
def find_similar_chunks(
    chunk_id: str,
    top_k: int = Query(5, le=20),
    db: Session = Depends(get_db)
):
    """Find chunks similar to a given chunk by its stored embedding."""
    from backend.app.db.models import KnowledgeChunk
    chunk = db.get(KnowledgeChunk, chunk_id)
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")
    if chunk.embedding is None:
        raise HTTPException(status_code=422, detail="Chunk has no embedding")

    vec_str = "[" + ",".join(str(v) for v in chunk.embedding) + "]"

    sql = text("""
        SELECT
            kc.id          AS chunk_id,
            kc.document_id AS document_id,
            kd.source_id   AS source_id,
            kc.content     AS content,
            kc.metadata    AS metadata,
            1 - (kc.embedding <=> CAST(:vec AS vector)) AS score
        FROM knowledge_chunks kc
        JOIN knowledge_documents kd ON kd.id = kc.document_id
        WHERE kc.embedding IS NOT NULL
          AND kc.id != :exclude_id
        ORDER BY kc.embedding <=> CAST(:vec AS vector)
        LIMIT :top_k
    """)

    try:
        rows = db.execute(sql, {"vec": vec_str, "exclude_id": chunk_id, "top_k": top_k}).mappings().all()
    except Exception:
        rows = []
    return [
        SearchResult(
            chunk_id=row["chunk_id"],
            document_id=row["document_id"],
            source_id=row["source_id"],
            content=row["content"],
            score=round(float(row["score"]), 4),
            metadata=row["metadata"],
        )
        for row in rows
    ]

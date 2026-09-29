"""
RetrieverAgent — Step 1 of the VeriAI multi-agent pipeline.

Queries pgvector for the most relevant knowledge chunks by embedding
both the user question and the AI response, merging and deduplicating
the results into a ranked evidence pool.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

import re
from sqlalchemy.orm import Session
from sqlalchemy import text

from backend.app.services.embedding import embedding_service


@dataclass
class EvidenceChunk:
    chunk_id: str
    document_id: str
    source_id: str
    source_name: str
    dataset: str
    content: str
    score: float
    question: Optional[str] = None
    answer: Optional[str] = None
    category: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrieverResult:
    evidence: List[EvidenceChunk]
    query_embedding: List[float]
    response_embedding: List[float]
    evidence_status: str = "unavailable"  # "strong" | "moderate" | "weak" | "unavailable"


def _vec_str(vec: List[float]) -> str:
    return "[" + ",".join(str(v) for v in vec) + "]"


def _search(db: Session, vec: List[float], top_k: int, dataset: Optional[str]) -> List[Dict]:
    params: Dict[str, Any] = {"vec": _vec_str(vec), "top_k": top_k}
    dataset_filter = ""
    if dataset:
        dataset_filter = "AND (ks.dataset_name ILIKE :dataset OR ks.name ILIKE :dataset)"
        params["dataset"] = f"%{dataset}%"

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
          {dataset_filter}
        ORDER BY kc.embedding <=> CAST(:vec AS vector)
        LIMIT :top_k
    """)
    try:
        return list(db.execute(sql, params).mappings().all())
    except Exception as err:
        from backend.app.db.models import KnowledgeChunk, KnowledgeDocument, KnowledgeSource
        import math
        q_chunks = db.query(KnowledgeChunk, KnowledgeDocument, KnowledgeSource)\
                     .join(KnowledgeDocument, KnowledgeDocument.id == KnowledgeChunk.document_id)\
                     .join(KnowledgeSource, KnowledgeSource.id == KnowledgeDocument.source_id).all()
        rows = []
        for kc, kd, ks in q_chunks:
            if dataset and not (dataset.lower() in (ks.dataset_name or '').lower() or dataset.lower() in (ks.name or '').lower()):
                continue
            score = 0.5
            if kc.embedding and vec:
                try:
                    dot = sum(a * b for a, b in zip(kc.embedding, vec))
                    norm_a = math.sqrt(sum(a * a for a in kc.embedding))
                    norm_b = math.sqrt(sum(b * b for b in vec))
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
        return rows[:top_k]


class RetrieverAgent:
    """
    Embeds the question and AI response separately, performs two pgvector
    searches, then merges the results keeping the highest score per chunk.
    Also assesses overall evidence sufficiency (strong/moderate/weak/unavailable).
    """

    def run(
        self,
        db: Session,
        question: str,
        ai_response: str,
        top_k: int = 10,
        dataset: Optional[str] = None,
    ) -> RetrieverResult:
        query_vec = embedding_service.embed_text(question)
        response_vec = embedding_service.embed_text(ai_response) if ai_response.strip() else [0.0] * len(query_vec)

        q_rows = _search(db, query_vec, top_k, dataset) if question.strip() else []
        r_rows = _search(db, response_vec, top_k, dataset) if ai_response.strip() else []

        # Merge — keep highest score per chunk_id
        merged: Dict[str, Dict] = {}
        for row in q_rows + r_rows:
            cid = row["chunk_id"]
            if cid not in merged or float(row["score"]) > float(merged[cid]["score"]):
                merged[cid] = dict(row)

        # Sort descending by score, cap at top_k * 2
        ranked = sorted(merged.values(), key=lambda r: float(r["score"]), reverse=True)[: top_k * 2]

        evidence = []
        for row in ranked:
            meta = row["metadata"] or {}
            evidence.append(
                EvidenceChunk(
                    chunk_id=row["chunk_id"],
                    document_id=row["document_id"],
                    source_id=row["source_id"],
                    source_name=row["source_name"] or "Unknown",
                    dataset=row["dataset_name"] or "custom",
                    content=row["content"],
                    score=round(float(row["score"]), 4),
                    question=meta.get("question"),
                    answer=meta.get("answer") or meta.get("reference_answer"),
                    category=meta.get("category"),
                    metadata=meta,
                )
            )

        # Assess evidence sufficiency independently
        if not evidence:
            evidence_status = "unavailable"
        else:
            top_score = evidence[0].score
            top_content = (evidence[0].content or "").lower()
            stopwords = {
                "the", "a", "an", "is", "are", "was", "were", "what", "who", "when",
                "where", "how", "why", "did", "do", "does", "in", "of", "to", "and",
                "or", "for", "with", "about", "that", "this", "these", "those",
            }
            q_words = set(re.findall(r"\b[a-zA-Z0-9]{3,}\b", question.lower())) - stopwords
            r_words = set(re.findall(r"\b[a-zA-Z0-9]{3,}\b", ai_response.lower())) - stopwords
            c_words = set(re.findall(r"\b[a-zA-Z0-9]{3,}\b", top_content)) - stopwords
            has_overlap = bool((q_words & c_words) or (r_words & c_words))

            if top_score >= 0.78 or (top_score >= 0.68 and has_overlap):
                evidence_status = "strong"
            elif top_score >= 0.72 or (top_score >= 0.60 and has_overlap):
                evidence_status = "moderate"
            else:
                evidence_status = "weak"

        return RetrieverResult(
            evidence=evidence,
            query_embedding=query_vec,
            response_embedding=response_vec,
            evidence_status=evidence_status,
        )

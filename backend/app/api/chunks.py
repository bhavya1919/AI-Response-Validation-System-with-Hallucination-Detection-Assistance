"""
Routes for KnowledgeChunk — list chunks for a document
"""
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from backend.app.db.session import get_db
from backend.app.db.models import KnowledgeChunk

router = APIRouter()


class ChunkOut(BaseModel):
    id: str
    document_id: str
    chunk_index: int
    content: str
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    has_embedding: bool = False

    model_config = {"from_attributes": True}


@router.get("", response_model=List[ChunkOut])
def list_chunks(
    document_id: Optional[str] = Query(None, description="Filter chunks by document ID"),
    doc_id: Optional[str] = Query(None, description="Alias for document_id"),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    target_doc_id = document_id or doc_id
    q = db.query(KnowledgeChunk)
    if target_doc_id:
        q = q.filter(KnowledgeChunk.document_id == target_doc_id)
    chunks = (
        q.order_by(KnowledgeChunk.chunk_index)
        .offset(offset)
        .limit(limit)
        .all()
    )
    results = []
    for c in chunks:
        item = ChunkOut(
            id=c.id,
            document_id=c.document_id,
            chunk_index=c.chunk_index,
            content=c.content,
            metadata_json=c.metadata_json,
            created_at=c.created_at,
            has_embedding=c.embedding is not None,
        )
        results.append(item)
    return results


@router.get("/{chunk_id}", response_model=ChunkOut)
def get_chunk(chunk_id: str, db: Session = Depends(get_db)):
    chunk = db.get(KnowledgeChunk, chunk_id)
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")
    return ChunkOut(
        id=chunk.id,
        document_id=chunk.document_id,
        chunk_index=chunk.chunk_index,
        content=chunk.content,
        metadata_json=chunk.metadata_json,
        created_at=chunk.created_at,
        has_embedding=chunk.embedding is not None,
    )

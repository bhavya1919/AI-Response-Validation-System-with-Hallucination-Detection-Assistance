"""
CRUD routes for KnowledgeDocument
"""
from typing import List, Optional, Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from backend.app.db.session import get_db
from backend.app.db.models import KnowledgeDocument, KnowledgeSource

router = APIRouter()


class DocumentCreate(BaseModel):
    source_id: str
    title: str
    content: str
    metadata: Optional[Dict[str, Any]] = {}


class DocumentOut(BaseModel):
    id: str
    source_id: str
    title: str
    content: str
    metadata_json: Optional[Dict[str, Any]]
    created_at: datetime
    chunk_count: Optional[int] = 0

    model_config = {"from_attributes": True}


@router.get("", response_model=List[DocumentOut])
def list_documents(
    source_id: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db)
):
    q = db.query(KnowledgeDocument)
    if source_id:
        q = q.filter(KnowledgeDocument.source_id == source_id)
    docs = q.order_by(KnowledgeDocument.created_at.desc()).offset(offset).limit(limit).all()
    result = []
    for doc in docs:
        d = DocumentOut.model_validate(doc)
        d.chunk_count = len(doc.chunks)
        result.append(d)
    return result


@router.get("/{doc_id}", response_model=DocumentOut)
def get_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.get(KnowledgeDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    d = DocumentOut.model_validate(doc)
    d.chunk_count = len(doc.chunks)
    return d


@router.delete("/{doc_id}", status_code=204)
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.get(KnowledgeDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()

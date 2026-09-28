"""
CRUD routes for KnowledgeSource
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from backend.app.db.session import get_db
from backend.app.db.models import KnowledgeSource

router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class SourceCreate(BaseModel):
    name: str
    source_type: str
    description: Optional[str] = None
    dataset_name: Optional[str] = None

class SourceUpdate(BaseModel):
    name: Optional[str] = None
    source_type: Optional[str] = None
    description: Optional[str] = None
    dataset_name: Optional[str] = None
    status: Optional[str] = None

class SourceOut(BaseModel):
    id: str
    name: str
    source_type: str
    description: Optional[str]
    dataset_name: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("", response_model=List[SourceOut])
def list_sources(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(KnowledgeSource)
    if status:
        q = q.filter(KnowledgeSource.status == status)
    return q.order_by(KnowledgeSource.created_at.desc()).all()


@router.post("", response_model=SourceOut, status_code=201)
def create_source(body: SourceCreate, db: Session = Depends(get_db)):
    existing = db.query(KnowledgeSource).filter(KnowledgeSource.name == body.name).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Source '{body.name}' already exists")
    src = KnowledgeSource(**body.model_dump())
    db.add(src)
    db.commit()
    db.refresh(src)
    return src


@router.get("/{source_id}", response_model=SourceOut)
def get_source(source_id: str, db: Session = Depends(get_db)):
    src = db.get(KnowledgeSource, source_id)
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")
    return src


@router.patch("/{source_id}", response_model=SourceOut)
def update_source(source_id: str, body: SourceUpdate, db: Session = Depends(get_db)):
    src = db.get(KnowledgeSource, source_id)
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(src, field, value)
    db.commit()
    db.refresh(src)
    return src


@router.delete("/{source_id}", status_code=204)
def delete_source(source_id: str, db: Session = Depends(get_db)):
    src = db.get(KnowledgeSource, source_id)
    if not src:
        raise HTTPException(status_code=404, detail="Source not found")
    db.delete(src)
    db.commit()

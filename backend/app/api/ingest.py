"""
Document ingestion endpoint — accepts raw text, chunks it, embeds, and stores in pgvector
"""
from typing import Optional, Any, Dict, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.app.db.session import get_db
from backend.app.db.models import KnowledgeSource
from backend.app.ingestion.common import get_or_create_source, ingest_document_with_chunks

router = APIRouter()


class IngestTextRequest(BaseModel):
    # Source info
    source_name: str
    source_type: str = "custom"
    source_description: Optional[str] = None
    dataset_name: Optional[str] = None
    # Document info
    title: str
    content: str
    metadata: Optional[Dict[str, Any]] = {}


class IngestBatchRequest(BaseModel):
    source_name: str
    source_type: str = "custom"
    source_description: Optional[str] = None
    dataset_name: Optional[str] = None
    documents: List[Dict[str, Any]]  # Each: {title, content, metadata?}


class IngestResponse(BaseModel):
    document_id: str
    source_id: str
    chunk_count: int
    title: str


class IngestBatchResponse(BaseModel):
    source_id: str
    documents_ingested: int
    total_chunks: int
    skipped: int


@router.post("/text", response_model=IngestResponse, status_code=201)
def ingest_text(body: IngestTextRequest, db: Session = Depends(get_db)):
    """
    Ingest a single document: chunk → embed → store in pgvector.
    Creates the KnowledgeSource if it doesn't exist.
    """
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Content must not be empty")

    source = get_or_create_source(
        db=db,
        name=body.source_name,
        source_type=body.source_type,
        description=body.source_description or "",
        dataset_name=body.dataset_name or "",
    )

    doc, chunk_count = ingest_document_with_chunks(
        db=db,
        source=source,
        title=body.title,
        content=body.content,
        metadata=body.metadata or {},
    )

    if doc is None:
        raise HTTPException(status_code=422, detail="Document content was empty after cleaning")

    return IngestResponse(
        document_id=doc.id,
        source_id=source.id,
        chunk_count=chunk_count,
        title=doc.title,
    )


@router.post("/batch", response_model=IngestBatchResponse, status_code=201)
def ingest_batch(body: IngestBatchRequest, db: Session = Depends(get_db)):
    """
    Ingest multiple documents for the same source in one request.
    """
    if not body.documents:
        raise HTTPException(status_code=400, detail="documents list must not be empty")

    source = get_or_create_source(
        db=db,
        name=body.source_name,
        source_type=body.source_type,
        description=body.source_description or "",
        dataset_name=body.dataset_name or "",
    )

    total_chunks = 0
    ingested = 0
    skipped = 0

    for doc_data in body.documents:
        title = doc_data.get("title", "Untitled")
        content = doc_data.get("content", "")
        metadata = doc_data.get("metadata", {})

        doc, chunk_count = ingest_document_with_chunks(
            db=db,
            source=source,
            title=title,
            content=content,
            metadata=metadata,
        )

        if doc is None:
            skipped += 1
        else:
            ingested += 1
            total_chunks += chunk_count

    return IngestBatchResponse(
        source_id=source.id,
        documents_ingested=ingested,
        total_chunks=total_chunks,
        skipped=skipped,
    )


class IngestDatasetRequest(BaseModel):
    sample_size: Optional[int] = None


@router.post("/squad", status_code=201)
def ingest_squad_endpoint(
    body: Optional[IngestDatasetRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Ingest SQuAD benchmark dataset from Hugging Face.
    """
    from backend.app.ingestion.squad import ingest_squad
    sample_size = body.sample_size if body else None
    stats = ingest_squad(db, sample_size=sample_size)
    return stats


@router.post("/truthfulqa", status_code=201)
def ingest_truthfulqa_endpoint(
    body: Optional[IngestDatasetRequest] = None,
    db: Session = Depends(get_db)
):
    """
    Ingest TruthfulQA benchmark dataset from Hugging Face.
    """
    from backend.app.ingestion.truthfulqa import ingest_truthfulqa
    sample_size = body.sample_size if body else None
    stats = ingest_truthfulqa(db, sample_size=sample_size)
    return stats


@router.post("/benchmark", status_code=201)
def ingest_benchmark_endpoint(
    db: Session = Depends(get_db)
):
    """
    Ingest VeriAI 50-Question Benchmark dataset into PostgreSQL/pgvector.
    """
    from backend.app.ingestion.benchmark import ingest_benchmark
    stats = ingest_benchmark(db, force_reingest=True)
    return stats


@router.get("/stats")
def ingestion_stats(db: Session = Depends(get_db)):
    """Quick stats: how many sources, documents, chunks are indexed, with dataset breakdown."""
    from backend.app.db.models import KnowledgeDocument, KnowledgeChunk
    from sqlalchemy import func

    sources = db.query(func.count(KnowledgeSource.id)).scalar()
    documents = db.query(func.count(KnowledgeDocument.id)).scalar()
    chunks = db.query(func.count(KnowledgeChunk.id)).scalar()
    embedded = db.query(func.count(KnowledgeChunk.id)).filter(
        KnowledgeChunk.embedding.isnot(None)
    ).scalar()

    # Breakdown by dataset
    dataset_rows = (
        db.query(
            KnowledgeSource.dataset_name,
            func.count(func.distinct(KnowledgeDocument.id)).label("doc_count"),
            func.count(KnowledgeChunk.id).label("chunk_count")
        )
        .outerjoin(KnowledgeDocument, KnowledgeDocument.source_id == KnowledgeSource.id)
        .outerjoin(KnowledgeChunk, KnowledgeChunk.document_id == KnowledgeDocument.id)
        .group_by(KnowledgeSource.dataset_name)
        .all()
    )

    datasets_breakdown = {}
    for ds_name, doc_c, chunk_c in dataset_rows:
        key = ds_name or "custom"
        datasets_breakdown[key] = {
            "documents": doc_c,
            "chunks": chunk_c
        }

    return {
        "sources": sources,
        "documents": documents,
        "chunks": chunks,
        "chunks_with_embeddings": embedded,
        "datasets": datasets_breakdown
    }


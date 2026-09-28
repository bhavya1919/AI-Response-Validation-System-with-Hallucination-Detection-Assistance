import re
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from backend.app.db.models import KnowledgeSource, KnowledgeDocument, KnowledgeChunk
from backend.app.services.chunking import chunking_service
from backend.app.services.embedding import embedding_service

def clean_text(text: str) -> str:
    """
    Normalizes whitespace and cleans artifacts from raw text.
    """
    if not text:
        return ""
    # Normalize unicode whitespace
    text = re.sub(r"[\r\n\t]+", " ", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()

def get_or_create_source(
    db: Session,
    name: str,
    source_type: str,
    description: str,
    dataset_name: str
) -> KnowledgeSource:
    source = db.query(KnowledgeSource).filter(KnowledgeSource.name == name).first()
    if not source:
        source = KnowledgeSource(
            name=name,
            source_type=source_type,
            description=description,
            dataset_name=dataset_name,
            status="active"
        )
        db.add(source)
        db.commit()
        db.refresh(source)
    return source

def ingest_document_with_chunks(
    db: Session,
    source: KnowledgeSource,
    title: str,
    content: str,
    metadata: Dict[str, Any]
) -> tuple[KnowledgeDocument, int]:
    """
    Creates KnowledgeDocument, generates chunks, computes embeddings, and stores in PostgreSQL/pgvector.
    """
    cleaned_content = clean_text(content)
    if not cleaned_content:
        return None, 0

    doc = KnowledgeDocument(
        source_id=source.id,
        title=title,
        content=cleaned_content,
        metadata_json=metadata
    )
    db.add(doc)
    db.flush()

    raw_chunks = chunking_service.create_chunks_for_document(
        document_id=doc.id,
        content=cleaned_content,
        source_name=source.name,
        dataset_name=source.dataset_name,
        extra_metadata=metadata
    )

    if not raw_chunks:
        db.commit()
        db.refresh(doc)
        return doc, 0

    chunk_texts = [c["content"] for c in raw_chunks]
    embeddings = embedding_service.embed_documents(chunk_texts)

    for chunk_data, emb in zip(raw_chunks, embeddings):
        chunk_obj = KnowledgeChunk(
            document_id=doc.id,
            chunk_index=chunk_data["chunk_index"],
            content=chunk_data["content"],
            metadata_json=chunk_data["metadata"],
            embedding=emb
        )
        db.add(chunk_obj)

    db.commit()
    db.refresh(doc)
    return doc, len(raw_chunks)


def get_existing_record_ids(db: Session, dataset_name: str) -> set[str]:
    """
    Returns the set of existing record_ids for a dataset to ensure idempotency.
    """
    if db.bind and db.bind.dialect.name == "sqlite":
        docs = db.query(KnowledgeDocument.metadata_json).all()
        result = set()
        for doc in docs:
            meta = doc[0] or {}
            if meta.get("dataset") == dataset_name and "record_id" in meta:
                result.add(str(meta["record_id"]))
        return result
    try:
        rows = (
            db.query(KnowledgeDocument.metadata_json["record_id"].astext)
            .filter(KnowledgeDocument.metadata_json["dataset"].astext == dataset_name)
            .all()
        )
        return {r[0] for r in rows if r[0]}
    except Exception:
        docs = db.query(KnowledgeDocument.metadata_json).all()
        result = set()
        for doc in docs:
            meta = doc[0] or {}
            if meta.get("dataset") == dataset_name and "record_id" in meta:
                result.add(str(meta["record_id"]))
        return result


def batch_ingest_records(
    db: Session,
    source: KnowledgeSource,
    items: List[Dict[str, Any]],
    batch_size: int = 50
) -> Dict[str, int]:
    """
    Idempotently ingests multiple records with batched chunking and embeddings.
    Each item in `items` is expected to have:
      - title: str
      - content: str
      - metadata: dict (containing 'record_id', 'dataset', etc.)
    """
    existing_ids = get_existing_record_ids(db, source.dataset_name)
    processed = 0
    skipped = 0
    documents_created = 0
    chunks_created = 0

    batch_docs = []
    batch_raw_chunks = []

    for item in items:
        rec_id = item.get("metadata", {}).get("record_id")
        if rec_id and rec_id in existing_ids:
            skipped += 1
            continue

        cleaned_content = clean_text(item.get("content", ""))
        if not cleaned_content:
            skipped += 1
            continue

        meta = item.get("metadata", {})
        doc = KnowledgeDocument(
            source_id=source.id,
            title=item.get("title", f"{source.name} Document"),
            content=cleaned_content,
            metadata_json=meta
        )
        db.add(doc)
        db.flush()

        raw_chunks = chunking_service.create_chunks_for_document(
            document_id=doc.id,
            content=cleaned_content,
            source_name=source.name,
            dataset_name=source.dataset_name,
            extra_metadata=meta
        )

        batch_docs.append(doc)
        batch_raw_chunks.extend(raw_chunks)
        if rec_id:
            existing_ids.add(rec_id)
        documents_created += 1

        # Process embeddings and persist when batch threshold reached
        if len(batch_raw_chunks) >= batch_size:
            chunk_texts = [c["content"] for c in batch_raw_chunks]
            embeddings = embedding_service.embed_documents(chunk_texts)
            for chunk_data, emb in zip(batch_raw_chunks, embeddings):
                chunk_obj = KnowledgeChunk(
                    document_id=chunk_data["metadata"]["document_id"],
                    chunk_index=chunk_data["chunk_index"],
                    content=chunk_data["content"],
                    metadata_json=chunk_data["metadata"],
                    embedding=emb
                )
                db.add(chunk_obj)
            chunks_created += len(batch_raw_chunks)
            db.commit()
            batch_raw_chunks = []
            batch_docs = []

        processed += 1

    # Flush remaining chunks
    if batch_raw_chunks:
        chunk_texts = [c["content"] for c in batch_raw_chunks]
        embeddings = embedding_service.embed_documents(chunk_texts)
        for chunk_data, emb in zip(batch_raw_chunks, embeddings):
            chunk_obj = KnowledgeChunk(
                document_id=chunk_data["metadata"]["document_id"],
                chunk_index=chunk_data["chunk_index"],
                content=chunk_data["content"],
                metadata_json=chunk_data["metadata"],
                embedding=emb
            )
            db.add(chunk_obj)
        chunks_created += len(batch_raw_chunks)
        db.commit()

    return {
        "processed": processed,
        "skipped": skipped,
        "documents_created": documents_created,
        "chunks_created": chunks_created
    }


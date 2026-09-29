import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey, Index, JSON
from sqlalchemy.dialects.postgresql import JSONB

JSONB_TYPE = JSONB().with_variant(JSON, "sqlite")
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import relationship

from backend.app.config import settings
from backend.app.db.base import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(128), nullable=False, unique=True)
    source_type = Column(String(64), nullable=False)
    description = Column(Text, nullable=True)
    dataset_name = Column(String(128), nullable=True)
    status = Column(String(32), default="active")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    documents = relationship("KnowledgeDocument", back_populates="source", cascade="all, delete-orphan")


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    source_id = Column(String(36), ForeignKey("knowledge_sources.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(256), nullable=False)
    content = Column(Text, nullable=False)
    metadata_json = Column("metadata", JSONB_TYPE, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    source = relationship("KnowledgeSource", back_populates="documents")
    chunks = relationship("KnowledgeChunk", back_populates="document", cascade="all, delete-orphan")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    document_id = Column(String(36), ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    metadata_json = Column("metadata", JSONB_TYPE, default=dict)
    embedding = Column(Vector(settings.VECTOR_DIMENSION), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    document = relationship("KnowledgeDocument", back_populates="chunks")

    __table_args__ = (
        Index(
            "ix_knowledge_chunks_embedding",
            embedding,
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    title = Column(String(256), nullable=True)
    question = Column(Text, nullable=False)
    ai_response = Column(Text, nullable=False)
    reference_answer = Column(Text, nullable=True)
    source_document = Column(Text, nullable=True)
    dataset = Column(String(128), nullable=True)
    overall_score = Column(Integer, nullable=False, default=0)
    verdict = Column(String(32), nullable=False, default="PASS")
    confidence = Column(String(32), nullable=False, default="medium")
    accuracy_score = Column(Integer, nullable=False, default=0)
    relevance_score = Column(Integer, nullable=False, default=0)
    hallucination_risk = Column(Integer, nullable=False, default=0)
    completeness_score = Column(Integer, nullable=False, default=0)
    evidence_status = Column(String(32), nullable=False, default="moderate")
    reasons_json = Column("reasons", JSONB_TYPE, default=list)
    metadata_json = Column("metadata", JSONB_TYPE, default=dict)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    claims = relationship("EvaluationClaim", back_populates="evaluation", cascade="all, delete-orphan")
    evidence = relationship("EvaluationEvidence", back_populates="evaluation", cascade="all, delete-orphan")


class EvaluationClaim(Base):
    __tablename__ = "evaluation_claims"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    evaluation_id = Column(String(64), ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False)
    claim = Column(Text, nullable=False)
    status = Column(String(32), nullable=False)
    similarity = Column(Float, default=0.0)
    confidence = Column(Float, default=0.0)
    evidence = Column(Text, nullable=True)
    source = Column(String(256), nullable=True)
    dataset = Column(String(128), nullable=True)
    relevance = Column(Integer, default=0)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    evaluation = relationship("Evaluation", back_populates="claims")


class EvaluationEvidence(Base):
    __tablename__ = "evaluation_evidence"

    id = Column(String(64), primary_key=True, default=generate_uuid)
    evaluation_id = Column(String(64), ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String(256), nullable=True)
    dataset = Column(String(128), nullable=True)
    document_id = Column(String(64), nullable=True)
    chunk_id = Column(String(64), nullable=True)
    similarity = Column(Float, default=0.0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    evaluation = relationship("Evaluation", back_populates="evidence")

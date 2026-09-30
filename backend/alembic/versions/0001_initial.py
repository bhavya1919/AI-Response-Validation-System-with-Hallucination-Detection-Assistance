"""Initial schema: pgvector, 6 tables matching SQLAlchemy ORM models, HNSW index.

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pgvector extension (idempotent in PostgreSQL)
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 1. Knowledge Sources
    op.create_table(
        "knowledge_sources",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("name", sa.String(128), nullable=False, unique=True),
        sa.Column("source_type", sa.String(64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("dataset_name", sa.String(128), nullable=True),
        sa.Column("status", sa.String(32), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # 2. Knowledge Documents
    op.create_table(
        "knowledge_documents",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "source_id",
            sa.String(36),
            sa.ForeignKey("knowledge_sources.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # 3. Knowledge Chunks
    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("embedding", Vector(384), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # HNSW Cosine Distance Vector Index
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_knowledge_chunks_embedding
        ON knowledge_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        """
    )

    # 4. Evaluations
    op.create_table(
        "evaluations",
        sa.Column("id", sa.String(64), primary_key=True, nullable=False),
        sa.Column("title", sa.String(256), nullable=True),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("ai_response", sa.Text(), nullable=False),
        sa.Column("reference_answer", sa.Text(), nullable=True),
        sa.Column("source_document", sa.Text(), nullable=True),
        sa.Column("dataset", sa.String(128), nullable=True),
        sa.Column("overall_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("verdict", sa.String(32), nullable=False, server_default="PASS"),
        sa.Column("confidence", sa.String(32), nullable=False, server_default="medium"),
        sa.Column("accuracy_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("relevance_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("hallucination_risk", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completeness_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("evidence_status", sa.String(32), nullable=False, server_default="moderate"),
        sa.Column(
            "reasons",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # 5. Evaluation Claims
    op.create_table(
        "evaluation_claims",
        sa.Column("id", sa.String(64), primary_key=True, nullable=False),
        sa.Column(
            "evaluation_id",
            sa.String(64),
            sa.ForeignKey("evaluations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("claim", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("similarity", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("confidence", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("source", sa.String(256), nullable=True),
        sa.Column("dataset", sa.String(128), nullable=True),
        sa.Column("relevance", sa.Integer(), server_default="0", nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # 6. Evaluation Evidence
    op.create_table(
        "evaluation_evidence",
        sa.Column("id", sa.String(64), primary_key=True, nullable=False),
        sa.Column(
            "evaluation_id",
            sa.String(64),
            sa.ForeignKey("evaluations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source", sa.String(256), nullable=True),
        sa.Column("dataset", sa.String(128), nullable=True),
        sa.Column("document_id", sa.String(64), nullable=True),
        sa.Column("chunk_id", sa.String(64), nullable=True),
        sa.Column("similarity", sa.Float(), server_default="0.0", nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("evaluation_evidence")
    op.drop_table("evaluation_claims")
    op.drop_table("evaluations")
    op.execute("DROP INDEX IF EXISTS ix_knowledge_chunks_embedding;")
    op.drop_table("knowledge_chunks")
    op.drop_table("knowledge_documents")
    op.drop_table("knowledge_sources")

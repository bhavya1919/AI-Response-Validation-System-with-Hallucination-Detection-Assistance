"""
POST /api/evaluate
GET  /api/evaluate/history
GET  /api/evaluate/stats/dashboard
GET  /api/evaluate/{id}
DELETE /api/evaluate/{id}

Orchestrates the VeriAI Milestone 2 multi-agent evaluation pipeline:
  1. RetrieverAgent             — fetch evidence once from pgvector
  2. [RelevanceJudgeAgent,      — parallel evaluation context
      AccuracyAgent,
      HallucinationAgent]
  3. VerdictAgent               — synthesize final score, verdict, and reasoning
  4. Persistence                — store complete evaluation record in PostgreSQL
"""
from __future__ import annotations

import io
import csv
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.db.session import get_db
from backend.app.db.models import (
    Evaluation,
    EvaluationClaim,
    EvaluationEvidence,
    KnowledgeSource,
    KnowledgeDocument,
    KnowledgeChunk,
)
from backend.app.agents.retriever import RetrieverAgent, EvidenceChunk
from backend.app.agents.relevance import RelevanceJudgeAgent, RelevanceResult
from backend.app.agents.accuracy import AccuracyAgent, AccuracyResult
from backend.app.agents.hallucination import HallucinationAgent, HallucinationResult
from backend.app.agents.completeness import CompletenessJudgeAgent, CompletenessResult
from backend.app.agents.verdict import VerdictAgent, VerdictResult

router = APIRouter()


# ── Request / Response schemas ────────────────────────────────────────────────

class EvaluateRequest(BaseModel):
    question: str
    ai_response: str
    reference_answer: Optional[str] = None
    source_document: Optional[str] = None
    dataset: Optional[str] = None   # e.g. "squad", "truthfulqa" — filters KB scope
    top_k: int = 10


class ClaimOut(BaseModel):
    id: str
    claim: str
    status: str           # "supported" | "partial" | "unsupported" | "contradicted" | "incorrect"
    evidenceText: str
    best_evidence: str = ""
    source: str
    relevance: int
    note: str
    similarity: float = 0.0
    confidence: float = 0.0


class ReasonOut(BaseModel):
    text: str
    positive: bool


class ScoresOut(BaseModel):
    relevance: int
    accuracy: int
    hallucinationRisk: int
    completeness: int


class EvidenceOut(BaseModel):
    chunk_id: str
    source_name: str
    dataset: str
    content: str
    score: float
    question: Optional[str] = None
    answer: Optional[str] = None


# ── Milestone 2 Separated Structured Output Schemas ───────────────────────────

class RelevanceOut(BaseModel):
    score: int
    label: str
    label_display: Optional[str] = None
    reasoning: str
    signals: Optional[Dict[str, Any]] = None


class AccuracyClaimOut(BaseModel):
    claim: str
    status: str          # "SUPPORTED" | "PARTIAL" | "INCORRECT" | "CONTRADICTED" | "UNSUPPORTED"
    similarity: float
    evidence: str


class AccuracyOut(BaseModel):
    score: int
    status: Optional[str] = None
    reasoning: str
    supported_count: int = 0
    partial_count: int = 0
    unsupported_count: int = 0
    contradicted_count: int = 0
    claims: List[AccuracyClaimOut]


class FlaggedClaimOut(BaseModel):
    claim: str
    status: str          # "UNSUPPORTED" | "CONTRADICTED" | "HALLUCINATED"
    reasoning: str
    evidence: str


class HallucinationOut(BaseModel):
    risk_score: int
    status: str          # "low" | "moderate" | "high" | "critical"
    reasoning: str
    flagged_claims: List[FlaggedClaimOut]


class CompletenessOut(BaseModel):
    score: int
    status: Optional[str] = None
    reasoning: str
    addressed_aspects: Optional[List[str]] = None
    partial_aspects: Optional[List[str]] = None
    covered_aspects: Optional[List[str]] = None
    missing_aspects: Optional[List[str]] = None


class VerdictDetailOut(BaseModel):
    overall_score: int
    label: str           # "PASS" | "REVIEW" | "FAIL"
    reasoning: str
    major_strengths: Optional[List[str]] = None
    major_issues: Optional[List[str]] = None


class EvaluateResponse(BaseModel):
    id: str
    title: str
    question: str
    aiResponse: str
    referenceAnswer: str
    overallScore: int
    verdict: str
    confidence: str
    evidence_status: str = "moderate"
    scores: ScoresOut
    claims: List[ClaimOut]
    reasons: List[ReasonOut]
    evidence: List[EvidenceOut]
    metadata: Dict[str, Any] = {}
    evaluatedAt: str

    # Milestone 2 separated outputs
    relevance: Optional[RelevanceOut] = None
    accuracy: Optional[AccuracyOut] = None
    hallucination: Optional[HallucinationOut] = None
    completeness: Optional[CompletenessOut] = None
    verdict_detail: Optional[VerdictDetailOut] = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/history")
def get_evaluation_history(
    verdict: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    """
    Returns list of evaluations from PostgreSQL with optional filtering and search.
    """
    query = db.query(Evaluation)
    if verdict and verdict.upper() in ("PASS", "REVIEW", "FAIL"):
        query = query.filter(Evaluation.verdict == verdict.upper())
    if search and search.strip():
        query = query.filter(Evaluation.question.ilike(f"%{search.strip()}%"))

    total = query.count()
    records = query.order_by(Evaluation.created_at.desc()).offset(offset).limit(limit).all()

    pass_count = db.query(Evaluation).filter(Evaluation.verdict == "PASS").count()
    review_count = db.query(Evaluation).filter(Evaluation.verdict == "REVIEW").count()
    fail_count = db.query(Evaluation).filter(Evaluation.verdict == "FAIL").count()

    items = []
    for r in records:
        items.append({
            "id": r.id,
            "title": r.title or (r.question[:40] + "…" if len(r.question) > 40 else r.question),
            "question": r.question,
            "aiResponse": r.ai_response,
            "referenceAnswer": r.reference_answer or "N/A",
            "overallScore": r.overall_score,
            "verdict": r.verdict,
            "confidence": r.confidence,
            "evidence_status": r.evidence_status,
            "scores": {
                "relevance": r.relevance_score,
                "accuracy": r.accuracy_score,
                "hallucinationRisk": r.hallucination_risk,
                "completeness": r.completeness_score,
            },
            "claimsCount": len(r.claims) if r.claims else 0,
            "dataset": r.dataset or "general",
            "evaluatedAt": r.created_at.strftime("%b %d, %Y · %H:%M") if r.created_at else "Just now",
        })

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "summary": {
            "pass": pass_count,
            "review": review_count,
            "fail": fail_count,
        },
    }


@router.get("/stats/dashboard")
def get_dashboard_stats(
    batch_id: Optional[str] = Query(None, description="Filter dashboard stats by batch ID"),
    verdict: Optional[str] = Query(None, description="Filter dashboard stats by verdict"),
    db: Session = Depends(get_db),
):
    """
    M4.1 — Visual Evaluation Scoring Dashboard API.
    Computes comprehensive evaluation metrics, dimension distributions, hallucination frequency,
    completeness gaps, top recurring issues, and batch breakdowns directly from stored PostgreSQL records.
    """
    query = db.query(Evaluation)
    if verdict and verdict.upper() in ("PASS", "REVIEW", "FAIL"):
        query = query.filter(Evaluation.verdict == verdict.upper())
    
    evaluations = query.all()
    if batch_id and batch_id.strip():
        evaluations = [
            e for e in evaluations
            if (e.metadata_json or {}).get("batch_id") == batch_id.strip()
        ]
    eval_count = len(evaluations)

    source_count = db.query(KnowledgeSource).count()
    doc_count = db.query(KnowledgeDocument).count()
    chunk_count = db.query(KnowledgeChunk).count()

    if eval_count == 0:
        return {
            "total_evaluations": 0,
            "pass_rate": 0.0,
            "avg_accuracy": 0.0,
            "avg_relevance": 0.0,
            "avg_hallucination_risk": 0.0,
            "avg_completeness": 0.0,
            "verdict_distribution": {"PASS": 0, "REVIEW": 0, "FAIL": 0},
            "hallucination_stats": {
                "responses_with_hallucinations": 0,
                "hallucination_percentage": 0.0,
                "total_unsupported_claims": 0,
                "total_contradicted_claims": 0,
            },
            "completeness_distribution": {
                "complete": 0, "partial": 0, "incomplete": 0, "missing_aspects_freq": {}
            },
            "score_distribution": {
                "90_100": 0, "75_89": 0, "50_74": 0, "below_50": 0
            },
            "top_issues": [],
            "recent_evaluations": [],
            "kb_stats": {
                "sources": source_count,
                "documents": doc_count,
                "chunks": chunk_count,
                "embeddings": chunk_count,
            },
        }

    pass_count = sum(1 for e in evaluations if e.verdict == "PASS")
    review_count = sum(1 for e in evaluations if e.verdict == "REVIEW")
    fail_count = sum(1 for e in evaluations if e.verdict == "FAIL")

    avg_score = round(sum(e.overall_score for e in evaluations) / eval_count, 1)
    avg_accuracy = round(sum(e.accuracy_score for e in evaluations) / eval_count, 1)
    avg_relevance = round(sum(e.relevance_score for e in evaluations) / eval_count, 1)
    avg_hallucination = round(sum(e.hallucination_risk for e in evaluations) / eval_count, 1)
    avg_completeness = round(sum(e.completeness_score for e in evaluations) / eval_count, 1)

    # Score distribution buckets
    score_dist = {"90_100": 0, "75_89": 0, "50_74": 0, "below_50": 0}
    for e in evaluations:
        if e.overall_score >= 90: score_dist["90_100"] += 1
        elif e.overall_score >= 75: score_dist["75_89"] += 1
        elif e.overall_score >= 50: score_dist["50_74"] += 1
        else: score_dist["below_50"] += 1

    # Hallucination detailed stats & claims scanning
    responses_with_h = 0
    total_unsupported = 0
    total_contradicted = 0
    issue_counts: Dict[str, int] = {
        "Low Factual Accuracy (<70%)": 0,
        "Low Relevance (<70%)": 0,
        "Incomplete Coverage (<70%)": 0,
        "Unsupported Claims Flagged": 0,
        "Factual Contradiction Detected": 0,
    }

    missing_aspects_freq: Dict[str, int] = {}
    comp_dist = {"complete": 0, "partial": 0, "incomplete": 0}

    for e in evaluations:
        has_h = False
        if e.hallucination_risk > 20:
            has_h = True
        
        # Check claims
        unsupp_in_e = sum(1 for c in e.claims if c.status.upper() == "UNSUPPORTED")
        contra_in_e = sum(1 for c in e.claims if c.status.upper() in ("CONTRADICTED", "INCORRECT"))
        
        if unsupp_in_e > 0 or contra_in_e > 0:
            has_h = True

        if has_h:
            responses_with_h += 1

        total_unsupported += unsupp_in_e
        total_contradicted += contra_in_e

        # Issues taxonomy
        if e.accuracy_score < 70: issue_counts["Low Factual Accuracy (<70%)"] += 1
        if e.relevance_score < 70: issue_counts["Low Relevance (<70%)"] += 1
        if e.completeness_score < 70: issue_counts["Incomplete Coverage (<70%)"] += 1
        if unsupp_in_e > 0: issue_counts["Unsupported Claims Flagged"] += 1
        if contra_in_e > 0: issue_counts["Factual Contradiction Detected"] += 1

        # Completeness breakdown
        if e.completeness_score >= 85: comp_dist["complete"] += 1
        elif e.completeness_score >= 55: comp_dist["partial"] += 1
        else: comp_dist["incomplete"] += 1

        meta = e.metadata_json or {}
        comp_meta = meta.get("completeness", {})
        missing_list = comp_meta.get("missing_aspects") or []
        for m in missing_list:
            clean_m = m.strip()
            if clean_m:
                missing_aspects_freq[clean_m] = missing_aspects_freq.get(clean_m, 0) + 1

    top_issues = [
        {"issue": k, "count": v, "percentage": round((v / eval_count) * 100, 1)}
        for k, v in sorted(issue_counts.items(), key=lambda item: item[1], reverse=True)
        if v > 0
    ]

    recents = sorted(evaluations, key=lambda x: x.created_at or datetime.min, reverse=True)[:6]
    recent_items = [
        {
            "id": r.id,
            "question": r.question,
            "verdict": r.verdict,
            "score": r.overall_score,
            "accuracy": r.accuracy_score,
            "hallucinationRisk": r.hallucination_risk,
            "completeness": r.completeness_score,
            "date": r.created_at.strftime("%b %d, %Y") if r.created_at else "Just now",
        }
        for r in recents
    ]

    return {
        "total_evaluations": eval_count,
        "pass_rate": round((pass_count / eval_count) * 100, 1),
        "avg_score": avg_score,
        "avg_accuracy": avg_accuracy,
        "avg_relevance": avg_relevance,
        "avg_hallucination_risk": avg_hallucination,
        "avg_completeness": avg_completeness,
        "verdict_distribution": {
            "PASS": pass_count,
            "REVIEW": review_count,
            "FAIL": fail_count,
        },
        "score_distribution": score_dist,
        "hallucination_stats": {
            "responses_with_hallucinations": responses_with_h,
            "hallucination_percentage": round((responses_with_h / eval_count) * 100, 1),
            "total_unsupported_claims": total_unsupported,
            "total_contradicted_claims": total_contradicted,
        },
        "completeness_distribution": {
            "complete": comp_dist["complete"],
            "partial": comp_dist["partial"],
            "incomplete": comp_dist["incomplete"],
            "missing_aspects_freq": missing_aspects_freq,
        },
        "top_issues": top_issues,
        "recent_evaluations": recent_items,
        "kb_stats": {
            "sources": source_count,
            "documents": doc_count,
            "chunks": chunk_count,
            "embeddings": chunk_count,
        },
    }



@router.post("", response_model=EvaluateResponse)
def evaluate(body: EvaluateRequest, db: Session = Depends(get_db)):
    """
    Full multi-agent evaluation pipeline with PostgreSQL persistence.
    Architecture:
      POST /api/evaluate → Orchestrator → RetrieverAgent (once)
        → [RelevanceJudgeAgent, AccuracyJudgeAgent, HallucinationDetectionAgent]
        → VerdictAgent → PostgreSQL
    """
    if not body.question or not body.question.strip():
        raise HTTPException(status_code=400, detail="question must not be empty")

    clean_response = (body.ai_response or "").strip()

    # ── Step 1: Retrieve evidence ONCE ─────────────────────────────────────────
    retriever = RetrieverAgent()
    retriever_result = retriever.run(
        db=db,
        question=body.question,
        ai_response=clean_response,
        top_k=body.top_k,
        dataset=body.dataset if body.dataset and body.dataset != "all" else None,
    )

    # If user provided a custom source document, incorporate it into evidence pool
    if body.source_document and body.source_document.strip():
        custom_chunk = EvidenceChunk(
            chunk_id=f"doc-{uuid.uuid4().hex[:8]}",
            document_id="user-source-doc",
            source_id="user-provided",
            source_name="Provided Source Document",
            dataset="custom",
            content=body.source_document.strip(),
            score=0.96,
            question=body.question,
            answer=None,
            category="Custom Grounding Document",
        )
        retriever_result.evidence.insert(0, custom_chunk)
        retriever_result.evidence_status = "strong"

    # ── Step 2: Three Judge Agents operate on the same context ────────────────
    # 2a. Relevance Judge Agent (M2.1)
    relevance_judge = RelevanceJudgeAgent()
    relevance_result = relevance_judge.run(
        question=body.question,
        ai_response=clean_response,
        evidence=retriever_result.evidence,
        reference_answer=body.reference_answer,
    )

    # 2b. Accuracy Judge Agent (M2.2)
    accuracy_judge = AccuracyAgent()
    accuracy_result = accuracy_judge.run(
        ai_response=clean_response,
        evidence=retriever_result.evidence,
        reference_answer=body.reference_answer,
    )

    # 2c. Hallucination Detection Agent (M2.3)
    hallucination_agent = HallucinationAgent()
    hallucination_result = hallucination_agent.run(
        accuracy=accuracy_result,
        evidence=retriever_result.evidence,
        ai_response=clean_response,
        reference_answer=body.reference_answer,
        evidence_status=retriever_result.evidence_status,
    )

    # ── Step 2d: Completeness Judge Agent (M3.1) ─────────────────────────────
    completeness_judge = CompletenessJudgeAgent()
    completeness_result = completeness_judge.run(
        question=body.question,
        ai_response=clean_response,
        reference_answer=body.reference_answer,
        evidence_chunks=[e.content for e in retriever_result.evidence[:3]],
        evidence_status=retriever_result.evidence_status,
    )

    # ── Step 3: Verdict Synthesis ─────────────────────────────────────────────
    verdict_agent = VerdictAgent()
    verdict_result = verdict_agent.run(
        question=body.question,
        ai_response=clean_response,
        retriever=retriever_result,
        accuracy=accuracy_result,
        hallucination=hallucination_result,
        reference_answer=body.reference_answer,
        relevance=relevance_result,
        completeness=completeness_result,
    )

    # ── Step 4: Serialization & Formatting ────────────────────────────────────
    eval_id = f"eval-{uuid.uuid4().hex[:8]}"

    # Legacy claims formatting for frontend backward compatibility
    claims_out = [
        ClaimOut(
            id=f"claim-{i}",
            claim=c.claim,
            status=c.status.lower(),
            evidenceText=c.evidence_text,
            best_evidence=c.evidence_text,
            source=c.source,
            relevance=c.relevance,
            note=c.note,
            similarity=c.similarity,
            confidence=c.confidence,
        )
        for i, c in enumerate(accuracy_result.claims)
    ]

    reasons_out = [ReasonOut(text=r.text, positive=r.positive) for r in verdict_result.reasons]

    evidence_out = [
        EvidenceOut(
            chunk_id=e.chunk_id,
            source_name=e.source_name,
            dataset=e.dataset,
            content=e.content[:350] + ("…" if len(e.content) > 350 else ""),
            score=e.score,
            question=e.question,
            answer=e.answer,
        )
        for e in retriever_result.evidence[:10]
    ]

    # Milestone 2 separated sections
    relevance_m2 = RelevanceOut(
        score=relevance_result.score,
        label=relevance_result.label,
        label_display=getattr(relevance_result, "label_display", "") or "Mostly Relevant",
        reasoning=relevance_result.reasoning,
        signals=getattr(relevance_result, "signals", None),
    )

    accuracy_m2 = AccuracyOut(
        score=accuracy_result.accuracy_score,
        status=getattr(accuracy_result, "status", "") or "Partially Correct",
        reasoning=accuracy_result.reasoning,
        supported_count=accuracy_result.supported_count,
        partial_count=accuracy_result.partial_count,
        unsupported_count=accuracy_result.unsupported_count,
        contradicted_count=accuracy_result.contradicted_count + accuracy_result.incorrect_count,
        claims=[
            AccuracyClaimOut(
                claim=c.claim,
                status=c.status.upper(),
                similarity=c.similarity,
                evidence=c.evidence_text,
            )
            for c in accuracy_result.claims
        ],
    )

    hallucination_m2 = HallucinationOut(
        risk_score=hallucination_result.risk_score,
        status=hallucination_result.status,
        reasoning=hallucination_result.reasoning,
        flagged_claims=[
            FlaggedClaimOut(
                claim=f.claim,
                status=f.status,
                reasoning=f.reasoning,
                evidence=f.evidence,
            )
            for f in hallucination_result.flagged_claims
        ],
    )

    completeness_score = verdict_result.scores.get("completeness", 0)

    # Use the full CompletenessJudgeAgent output for the M3 structured response
    completeness_m2 = CompletenessOut(
        score=completeness_result.score,
        status=completeness_result.status,
        reasoning=completeness_result.reasoning,
        addressed_aspects=completeness_result.addressed_aspects,
        partial_aspects=completeness_result.partial_aspects,
        covered_aspects=completeness_result.covered_aspects,
        missing_aspects=completeness_result.missing_aspects,
    )

    verdict_m2 = VerdictDetailOut(
        overall_score=verdict_result.overall_score,
        label=verdict_result.verdict,
        reasoning=verdict_result.reasoning,
        major_strengths=verdict_result.major_strengths,
        major_issues=verdict_result.major_issues,
    )

    # Derive short title from question
    short_title = body.question[:40] + ("…" if len(body.question) > 40 else "")

    # ── Step 5: Persistence into PostgreSQL ───────────────────────────────────
    try:
        eval_record = Evaluation(
            id=eval_id,
            title=short_title,
            question=body.question,
            ai_response=clean_response,
            reference_answer=body.reference_answer or None,
            source_document=body.source_document or None,
            dataset=body.dataset or "all",
            overall_score=verdict_result.overall_score,
            verdict=verdict_result.verdict,
            confidence=verdict_result.confidence,
            accuracy_score=verdict_result.scores.get("accuracy", 0),
            relevance_score=verdict_result.scores.get("relevance", 0),
            hallucination_risk=verdict_result.scores.get("hallucinationRisk", 0),
            completeness_score=completeness_score,
            evidence_status=retriever_result.evidence_status,
            reasons_json=[{"text": r.text, "positive": r.positive} for r in verdict_result.reasons],
            metadata_json={
                "embedding_model": "BAAI/bge-small-en-v1.5",
                "retrieval_top_k": body.top_k,
                "evidence_status": retriever_result.evidence_status,
                "grounding_mode": (
                    "reference_and_kb"
                    if (body.reference_answer and body.reference_answer.strip())
                    else "kb_only"
                ),
                "evaluator_type": "multi_agent_judge_pipeline",
                "relevance_label": relevance_result.label,
                "hallucination_status": hallucination_result.status,
                "relevance": relevance_m2.model_dump(),
                "accuracy": accuracy_m2.model_dump(),
                "hallucination": hallucination_m2.model_dump(),
                "completeness": completeness_m2.model_dump(),
                "verdict_detail": verdict_m2.model_dump(),
            },
        )
        db.add(eval_record)
        db.flush()

        for i, c in enumerate(accuracy_result.claims):
            db.add(
                EvaluationClaim(
                    id=f"clm-{eval_id}-{i}",
                    evaluation_id=eval_id,
                    claim=c.claim,
                    status=c.status.lower(),
                    similarity=float(c.similarity),
                    confidence=float(c.confidence),
                    evidence=c.evidence_text,
                    source=c.source,
                    dataset=c.source.lower() if c.source else "kb",
                    relevance=int(c.relevance),
                    note=c.note,
                )
            )

        for i, e in enumerate(retriever_result.evidence[:10]):
            db.add(
                EvaluationEvidence(
                    id=f"ev-{eval_id}-{i}",
                    evaluation_id=eval_id,
                    content=e.content,
                    source=e.source_name,
                    dataset=e.dataset,
                    document_id=e.document_id,
                    chunk_id=e.chunk_id,
                    similarity=float(e.score),
                )
            )

        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"[Warning] Failed to persist evaluation: {exc}")

    return EvaluateResponse(
        id=eval_id,
        title=short_title,
        question=body.question,
        aiResponse=body.ai_response,
        referenceAnswer=body.reference_answer or "Retrieved from benchmark knowledge base",
        overallScore=verdict_result.overall_score,
        verdict=verdict_result.verdict,
        confidence=verdict_result.confidence,
        evidence_status=retriever_result.evidence_status,
        scores=ScoresOut(**verdict_result.scores),
        claims=claims_out,
        reasons=reasons_out,
        evidence=evidence_out,
        metadata={
            "embedding_model": "BAAI/bge-small-en-v1.5",
            "retrieval_top_k": body.top_k,
            "evidence_status": retriever_result.evidence_status,
            "grounding_mode": (
                "reference_and_kb"
                if (body.reference_answer and body.reference_answer.strip())
                else "kb_only"
            ),
            "evaluator_type": "multi_agent_judge_pipeline",
        },
        evaluatedAt=verdict_result.evaluated_at,
        # Milestone 2 components
        relevance=relevance_m2,
        accuracy=accuracy_m2,
        hallucination=hallucination_m2,
        completeness=completeness_m2,
        verdict_detail=verdict_m2,
    )


@router.get("/{id}", response_model=EvaluateResponse)
def get_evaluation(id: str, db: Session = Depends(get_db)):
    """
    Fetch a complete evaluation by ID, including claim-by-claim analysis,
    retrieved evidence, and Milestone 2 judge breakdowns.
    """
    record = db.query(Evaluation).filter(Evaluation.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    claims_out = [
        ClaimOut(
            id=c.id,
            claim=c.claim,
            status=c.status.lower(),
            evidenceText=c.evidence or "",
            best_evidence=c.evidence or "",
            source=c.source or "Ground Truth",
            relevance=c.relevance,
            note=c.note or "",
            similarity=c.similarity,
            confidence=c.confidence,
        )
        for c in record.claims
    ]

    reasons_out = [
        ReasonOut(text=r.get("text", ""), positive=r.get("positive", True))
        for r in (record.reasons_json or [])
    ]

    evidence_out = [
        EvidenceOut(
            chunk_id=ev.chunk_id or ev.id,
            source_name=ev.source or "Reference Corpus",
            dataset=ev.dataset or "general",
            content=ev.content[:350] + ("…" if len(ev.content) > 350 else ""),
            score=ev.similarity,
        )
        for ev in record.evidence
    ]

    # Reconstruct Milestone 2 structures (from metadata_json if saved, else dynamically synthesized)
    meta = record.metadata_json or {}

    # 1. Relevance Agent Detail
    if "relevance" in meta and isinstance(meta["relevance"], dict):
        relevance_m2 = RelevanceOut(**meta["relevance"])
    else:
        score_val = record.relevance_score
        label_val = meta.get("relevance_label") or (
            "fully_relevant" if score_val >= 90 else (
                "mostly_relevant" if score_val >= 70 else (
                    "partially_relevant" if score_val >= 50 else (
                        "mostly_irrelevant" if score_val >= 25 else "completely_irrelevant"
                    )
                )
            )
        )
        label_disp = {
            "fully_relevant": "Fully Relevant",
            "mostly_relevant": "Mostly Relevant",
            "partially_relevant": "Partially Relevant",
            "mostly_irrelevant": "Mostly Irrelevant",
            "completely_irrelevant": "Completely Off-Topic",
        }.get(label_val, "Mostly Relevant")
        qual = (
            "directly and comprehensively answers the question scope" if score_val >= 90 else (
                "mostly answers the question with relevant focus and minor extraneous detail" if score_val >= 70 else (
                    "partially answers the question but omits core aspects" if score_val >= 50 else (
                        "exhibits only a weak relationship to the question" if score_val >= 25 else "is off-topic"
                    )
                )
            )
        )
        relevance_m2 = RelevanceOut(
            score=score_val,
            label=label_val,
            label_display=label_disp,
            reasoning=f"The response {qual}. Evaluated semantic relevance score is {score_val}/100.",
            signals={
                "semantic_similarity": round(score_val / 100.0, 2),
                "keyword_coverage": round(min(1.0, (record.completeness_score or score_val) / 100.0), 2),
                "topic_alignment": "high" if score_val >= 75 else ("moderate" if score_val >= 50 else "low"),
                "matched_concepts": [],
                "missing_concepts": [],
            },
        )

    # 2. Accuracy Agent Detail
    if "accuracy" in meta and isinstance(meta["accuracy"], dict):
        accuracy_m2 = AccuracyOut(**meta["accuracy"])
    else:
        acc_score = record.accuracy_score
        supp_count = sum(1 for c in record.claims if c.status.upper() == "SUPPORTED")
        part_count = sum(1 for c in record.claims if c.status.upper() == "PARTIAL")
        unsupp_count = sum(1 for c in record.claims if c.status.upper() == "UNSUPPORTED")
        contra_count = sum(1 for c in record.claims if c.status.upper() in ("CONTRADICTED", "INCORRECT"))
        tot_claims = len(record.claims)

        if acc_score >= 80:
            acc_status = "Verified Correct"
            acc_reason = f"High accuracy score ({acc_score}/100). All or most factual claims ({supp_count}/{tot_claims}) are verified and supported by certified evidence."
        elif acc_score >= 50:
            acc_status = "Partially Correct"
            acc_reason = f"Moderate accuracy score ({acc_score}/100). Found {supp_count} supported and {part_count} partial claim(s), with {unsupp_count} unsupported claim(s) lacking direct grounding."
        elif contra_count > 0:
            acc_status = "Factual Inaccuracies Detected"
            acc_reason = f"Low accuracy score ({acc_score}/100). Found {contra_count} contradicted or incorrect claim(s) directly conflicting with ground truth."
        else:
            acc_status = "Unverified Assertions"
            acc_reason = f"Low accuracy score ({acc_score}/100). {unsupp_count} of {tot_claims} claim(s) lack sufficient grounding in the knowledge base."

        accuracy_m2 = AccuracyOut(
            score=acc_score,
            status=acc_status,
            reasoning=acc_reason,
            supported_count=supp_count,
            partial_count=part_count,
            unsupported_count=unsupp_count,
            contradicted_count=contra_count,
            claims=[
                AccuracyClaimOut(
                    claim=c.claim,
                    status=c.status.upper(),
                    similarity=c.similarity or 0.0,
                    evidence=c.evidence or "",
                )
                for c in record.claims
            ],
        )

    # 3. Hallucination Detection Agent Detail
    if "hallucination" in meta and isinstance(meta["hallucination"], dict):
        hallucination_m2 = HallucinationOut(**meta["hallucination"])
    else:
        risk = record.hallucination_risk
        h_status = "critical" if risk >= 60 else ("high" if risk >= 35 else ("moderate" if risk >= 15 else "low"))
        flagged_list = [
            FlaggedClaimOut(
                claim=c.claim,
                status=c.status.upper(),
                reasoning=c.note or "Claim lacks sufficient supporting evidence in benchmark knowledge base.",
                evidence=c.evidence or "",
            )
            for c in record.claims
            if c.status.upper() in ("UNSUPPORTED", "CONTRADICTED", "INCORRECT", "PARTIAL")
        ]
        if h_status == "low":
            h_reason = f"Low hallucination risk ({risk}%). All factual claims are corroborated by verified evidence with no detected contradictions."
        elif h_status == "moderate":
            h_reason = f"Moderate hallucination risk ({risk}%). {len(flagged_list)} claim(s) lack direct or complete grounding in retrieved evidence."
        elif any(c.status.upper() in ("CONTRADICTED", "INCORRECT") for c in record.claims):
            h_reason = f"Critical hallucination risk ({risk}%). Detected factual contradictions directly conflicting with reference ground truth."
        else:
            h_reason = f"High hallucination risk ({risk}%). Multiple factual assertions could not be supported by retrieved evidence."

        hallucination_m2 = HallucinationOut(
            risk_score=risk,
            status=h_status,
            reasoning=h_reason,
            flagged_claims=flagged_list,
        )

    # 4. Completeness Detail
    if "completeness" in meta and isinstance(meta["completeness"], dict):
        comp_data = meta["completeness"]
        completeness_m2 = CompletenessOut(
            score=comp_data.get("score", 0),
            status=comp_data.get("status"),
            reasoning=comp_data.get("reasoning", ""),
            addressed_aspects=comp_data.get("addressed_aspects"),
            partial_aspects=comp_data.get("partial_aspects"),
            covered_aspects=comp_data.get("covered_aspects"),
            missing_aspects=comp_data.get("missing_aspects"),
        )
    else:
        c_score = record.completeness_score
        c_reason = (
            f"The response covers {c_score}% of the inquiry scope based on key concept analysis."
            if c_score >= 80 else
            f"The response partially addresses {c_score}% of the inquiry scope with some aspects omitted."
        )
        completeness_m2 = CompletenessOut(
            score=c_score,
            reasoning=c_reason,
            addressed_aspects=[],
            partial_aspects=[],
            covered_aspects=[],
            missing_aspects=[],
        )

    # 5. Final Verdict Detail
    if "verdict_detail" in meta and isinstance(meta["verdict_detail"], dict):
        vd = meta["verdict_detail"]
        verdict_m2 = VerdictDetailOut(
            overall_score=vd.get("overall_score", record.overall_score),
            label=vd.get("label", record.verdict),
            reasoning=vd.get("reasoning", ""),
            major_strengths=vd.get("major_strengths"),
            major_issues=vd.get("major_issues"),
        )
    else:
        o_score = record.overall_score
        v_label = record.verdict
        if v_label == "PASS":
            v_narrative = f"The response is directly relevant and factually accurate, with claims strongly supported by verified evidence, resulting in low hallucination risk ({record.hallucination_risk}%)."
        elif v_label == "REVIEW":
            v_narrative = f"The response is relevant and mostly accurate, but some claims lack sufficient supporting evidence, resulting in {record.hallucination_risk}% hallucination risk."
        else:
            v_narrative = f"The response failed evaluation due to low accuracy ({record.accuracy_score}/100) and elevated hallucination risk ({record.hallucination_risk}%)."

        verdict_m2 = VerdictDetailOut(
            overall_score=o_score,
            label=v_label,
            reasoning=f"{v_narrative} Final verdict is {v_label} with an overall score of {o_score}/100 ({record.confidence} confidence).",
            major_strengths=None,
            major_issues=None,
        )


    return EvaluateResponse(
        id=record.id,
        title=record.title or record.question[:40],
        question=record.question,
        aiResponse=record.ai_response,
        referenceAnswer=record.reference_answer or "Retrieved from benchmark knowledge base",
        overallScore=record.overall_score,
        verdict=record.verdict,
        confidence=record.confidence,
        evidence_status=record.evidence_status,
        scores=ScoresOut(
            relevance=record.relevance_score,
            accuracy=record.accuracy_score,
            hallucinationRisk=record.hallucination_risk,
            completeness=record.completeness_score,
        ),
        claims=claims_out,
        reasons=reasons_out,
        evidence=evidence_out,
        metadata=record.metadata_json or {},
        evaluatedAt=record.created_at.strftime("%b %d, %Y · %H:%M") if record.created_at else "Just now",
        relevance=relevance_m2,
        accuracy=accuracy_m2,
        hallucination=hallucination_m2,
        completeness=completeness_m2,
        verdict_detail=verdict_m2,
    )


@router.delete("/{id}")
def delete_evaluation(id: str, db: Session = Depends(get_db)):
    """
    Delete an evaluation record by ID.
    """
    record = db.query(Evaluation).filter(Evaluation.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    db.delete(record)
    db.commit()
    return {"status": "success", "message": f"Evaluation {id} deleted successfully"}


# ── M3.4 Batch Evaluation Endpoints ──────────────────────────────────────────

REQUIRED_BATCH_COLS = {"question", "ai_response"}


@router.post("/batch")
async def batch_evaluate(
    file: UploadFile = File(...),
    reference_column: Optional[str] = Query(None, description="CSV column name for reference answers"),
    top_k: int = Query(5, description="Evidence chunks per evaluation"),
    db: Session = Depends(get_db),
):
    """
    M3.4 — Upload a CSV file and evaluate each row through the full multi-agent pipeline.
    Columns required: question, ai_response
    Optional: reference_answer (or specify column name via reference_column)
    Failures on individual rows are captured and reported without stopping the batch.
    """
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")   # handle BOM
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)

    if not rows:
        raise HTTPException(status_code=400, detail="CSV file is empty.")

    # Validate headers with flexible matching
    headers_lower = {h.strip().lower(): h for h in (reader.fieldnames or [])}

    q_col = None
    for candidate in ["question", "prompt", "query", "input"]:
        if candidate in headers_lower:
            q_col = candidate
            break

    r_col = None
    for candidate in ["ai_response", "response", "answer", "model_output", "output", "generated_text"]:
        if candidate in headers_lower:
            r_col = candidate
            break

    if not q_col or not r_col:
        raise HTTPException(
            status_code=400,
            detail=f"CSV must include a question column ('question' or 'prompt') and an AI response column ('response' or 'ai_response'). Found columns: {', '.join(sorted(reader.fieldnames or []))}",
        )

    ref_col = None
    if reference_column and reference_column.strip().lower() in headers_lower:
        ref_col = reference_column.strip().lower()
    else:
        for candidate in ["reference", "reference_answer", "ground_truth", "target", "truth"]:
            if candidate in headers_lower:
                ref_col = candidate
                break

    batch_id = f"batch-{uuid.uuid4().hex[:10]}"
    started_at = datetime.now(timezone.utc).isoformat()

    results = []
    pass_count = rev_count = fail_count = 0
    score_sum = rel_sum = acc_sum = hall_sum = comp_sum = 0
    valid_rows = []
    invalid_rows = []

    for i, raw_row in enumerate(rows):
        # Normalise keys
        row = {k.strip().lower(): (v or "").strip() for k, v in raw_row.items() if k}
        question = row.get(q_col, "").strip() if q_col else ""
        ai_response = row.get(r_col, "").strip() if r_col else ""
        reference = (row.get(ref_col, "").strip() if ref_col else "") or None

        if not question or not ai_response:
            invalid_rows.append({"row": i + 1, "reason": "Missing question or response content", "data": dict(raw_row)})
            results.append({"row": i + 1, "status": "failed", "error": "Missing question or response content"})
            continue

        try:
            # ── Retrieval ──────────────────────────────────────────────────
            retriever = RetrieverAgent()
            retriever_result = retriever.run(
                db=db, question=question, ai_response=ai_response, top_k=top_k
            )

            # ── Judges ────────────────────────────────────────────────────
            rel_result = RelevanceJudgeAgent().run(
                question=question, ai_response=ai_response,
                evidence=retriever_result.evidence, reference_answer=reference,
            )
            acc_result = AccuracyAgent().run(
                ai_response=ai_response, evidence=retriever_result.evidence,
                reference_answer=reference,
            )
            hall_result = HallucinationAgent().run(
                accuracy=acc_result, evidence=retriever_result.evidence,
                ai_response=ai_response, reference_answer=reference,
                evidence_status=retriever_result.evidence_status,
            )
            comp_result = CompletenessJudgeAgent().run(
                question=question, ai_response=ai_response,
                reference_answer=reference,
                evidence_chunks=[e.content for e in retriever_result.evidence[:3]],
                evidence_status=retriever_result.evidence_status,
            )
            verd_result = VerdictAgent().run(
                question=question, ai_response=ai_response,
                retriever=retriever_result, accuracy=acc_result,
                hallucination=hall_result, reference_answer=reference,
                relevance=rel_result, completeness=comp_result,
            )

            # ── Persist individual record ─────────────────────────────────
            row_id = f"eval-{uuid.uuid4().hex[:8]}"
            short_title = question[:40] + ("…" if len(question) > 40 else "")
            try:
                eval_record = Evaluation(
                    id=row_id,
                    title=short_title,
                    question=question,
                    ai_response=ai_response,
                    reference_answer=reference,
                    dataset="batch",
                    overall_score=verd_result.overall_score,
                    verdict=verd_result.verdict,
                    confidence=verd_result.confidence,
                    accuracy_score=verd_result.scores.get("accuracy", 0),
                    relevance_score=verd_result.scores.get("relevance", 0),
                    hallucination_risk=verd_result.scores.get("hallucinationRisk", 0),
                    completeness_score=comp_result.score,
                    evidence_status=retriever_result.evidence_status,
                    reasons_json=[{"text": r.text, "positive": r.positive} for r in verd_result.reasons],
                    metadata_json={
                        "batch_id": batch_id,
                        "batch_row": i + 1,
                        "evaluator_type": "batch_multi_agent",
                        "completeness": {
                            "score": comp_result.score, "status": comp_result.status,
                            "reasoning": comp_result.reasoning,
                            "addressed_aspects": comp_result.addressed_aspects,
                            "partial_aspects": comp_result.partial_aspects,
                            "covered_aspects": comp_result.covered_aspects,
                            "missing_aspects": comp_result.missing_aspects,
                        },
                        "verdict_detail": {
                            "overall_score": verd_result.overall_score, "label": verd_result.verdict,
                            "reasoning": verd_result.reasoning,
                            "major_strengths": verd_result.major_strengths,
                            "major_issues": verd_result.major_issues,
                        },
                    },
                )
                db.add(eval_record)
                db.commit()
            except Exception as db_exc:
                db.rollback()
                print(f"[Batch] Row {i+1} DB persist failed: {db_exc}")

            v = verd_result.verdict
            if v == "PASS":   pass_count += 1
            elif v == "REVIEW": rev_count += 1
            else:             fail_count += 1

            score_sum += verd_result.overall_score
            rel_sum   += verd_result.scores.get("relevance", 0)
            acc_sum   += acc_result.accuracy_score
            hall_sum  += hall_result.hallucination_risk
            comp_sum  += comp_result.score
            valid_rows.append(i)

            results.append({
                "row": i + 1,
                "id": row_id,
                "question": question[:80],
                "verdict": v,
                "overall_score": verd_result.overall_score,
                "scores": verd_result.scores,
                "completeness_status": comp_result.status,
                "status": "success",
            })

        except Exception as exc:
            invalid_rows.append({"row": i + 1, "reason": str(exc), "data": dict(raw_row)})
            results.append({"row": i + 1, "status": "failed", "error": str(exc)[:120]})

    n = len(valid_rows) or 1
    return {
        "batch_id": batch_id,
        "started_at": started_at,
        "total_rows": len(rows),
        "valid_rows": len(valid_rows),
        "evaluated_rows": len(valid_rows),   # alias for valid_rows (backward compat)
        "failed_rows": len(invalid_rows),
        "pass_count": pass_count,            # top-level alias for summary.pass
        "summary": {
            "pass": pass_count,
            "needs_improvement": rev_count,
            "fail": fail_count,
            "avg_score": round(score_sum / n, 1),
            "avg_relevance": round(rel_sum / n, 1),
            "avg_accuracy": round(acc_sum / n, 1),
            "avg_hallucination_risk": round(hall_sum / n, 1),
            "avg_completeness": round(comp_sum / n, 1),
        },
        "results": results,
        "failed_details": invalid_rows,
    }


@router.get("/batch/history")
def batch_history(limit: int = 20, db: Session = Depends(get_db)):
    """
    Return a list of recent batch runs derived from metadata_json.batch_id.
    """
    # Fetch all evaluations that have a batch_id in their metadata
    from sqlalchemy import text as sa_text
    try:
        recs = (
            db.query(Evaluation)
            .filter(Evaluation.metadata_json.isnot(None))
            .order_by(Evaluation.created_at.desc())
            .limit(limit * 50)
            .all()
        )
    except Exception:
        recs = []

    batches: Dict[str, Any] = {}
    for r in recs:
        bid = (r.metadata_json or {}).get("batch_id")
        if not bid:
            continue
        if bid not in batches:
            batches[bid] = {
                "batch_id": bid,
                "started_at": r.created_at.isoformat() if r.created_at else "",
                "total": 0, "pass": 0, "review": 0, "fail": 0,
                "avg_score": 0, "scores_sum": 0,
            }
        b = batches[bid]
        b["total"] += 1
        b["scores_sum"] += r.overall_score
        if r.verdict == "PASS":   b["pass"] += 1
        elif r.verdict == "REVIEW": b["review"] += 1
        else:                      b["fail"] += 1

    result = []
    for b in list(batches.values())[:limit]:
        n = b["total"] or 1
        result.append({
            "batch_id": b["batch_id"],
            "started_at": b["started_at"],
            "total": b["total"],
            "pass": b["pass"],
            "review": b["review"],
            "fail": b["fail"],
            "avg_score": round(b["scores_sum"] / n, 1),
        })
    return {"batches": result}


# ── M4.2 Evaluation PDF Report Export Endpoints ───────────────────────────────

from fastapi.responses import Response
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf_report_bytes(eval_record: Evaluation) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle', parent=styles['Heading1'], fontSize=18, leading=22, textColor=colors.HexColor('#6d28d9'), spaceAfter=4
    )
    subtitle_style = ParagraphStyle(
        'SubTitle', parent=styles['Normal'], fontSize=9, leading=12, textColor=colors.HexColor('#64748b'), spaceAfter=12
    )
    h2_style = ParagraphStyle(
        'H2', parent=styles['Heading2'], fontSize=12, leading=15, textColor=colors.HexColor('#0f172a'), spaceBefore=10, spaceAfter=6
    )
    body_style = ParagraphStyle(
        'Body', parent=styles['Normal'], fontSize=9, leading=13, textColor=colors.HexColor('#334155')
    )
    code_style = ParagraphStyle(
        'Code', parent=styles['Normal'], fontSize=8.5, leading=12, fontName='Helvetica-Oblique', textColor=colors.HexColor('#1e293b')
    )

    story = []

    # Title & Metadata Header
    story.append(Paragraph("<b>VeriAI Evaluation Audit Report</b>", title_style))
    story.append(Paragraph(f"Report Reference ID: <b>{eval_record.id}</b> | Evaluated: {eval_record.created_at.strftime('%Y-%m-%d %H:%M UTC') if eval_record.created_at else 'N/A'}", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=12))

    # Executive Summary Box Table
    verdict_color = colors.HexColor('#16a34a') if eval_record.verdict == 'PASS' else (colors.HexColor('#d97706') if eval_record.verdict == 'REVIEW' else colors.HexColor('#dc2626'))
    summary_data = [
        [
            Paragraph("<b>Overall Score</b>", body_style),
            Paragraph("<b>Verdict</b>", body_style),
            Paragraph("<b>Accuracy Score</b>", body_style),
            Paragraph("<b>Relevance Score</b>", body_style),
            Paragraph("<b>Hallucination Risk</b>", body_style),
            Paragraph("<b>Completeness Score</b>", body_style),
        ],
        [
            Paragraph(f"<font size=14 color='#6d28d9'><b>{eval_record.overall_score}/100</b></font>", body_style),
            Paragraph(f"<font size=14 color='{verdict_color.hexval()}'><b>{eval_record.verdict}</b></font>", body_style),
            Paragraph(f"<b>{eval_record.accuracy_score}%</b>", body_style),
            Paragraph(f"<b>{eval_record.relevance_score}%</b>", body_style),
            Paragraph(f"<b>{eval_record.hallucination_risk}%</b>", body_style),
            Paragraph(f"<b>{eval_record.completeness_score}%</b>", body_style),
        ]
    ]
    sum_table = Table(summary_data, colWidths=[90, 85, 90, 90, 100, 95])
    sum_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(sum_table)
    story.append(Spacer(1, 14))

    # Question & Response Section
    story.append(Paragraph("1. Target Question & AI Response", h2_style))
    q_data = [
        [Paragraph("<b>Submitted Question:</b>", body_style), Paragraph(eval_record.question, body_style)],
        [Paragraph("<b>Evaluated AI Response:</b>", body_style), Paragraph(eval_record.ai_response, code_style)],
    ]
    if eval_record.reference_answer:
        q_data.append([Paragraph("<b>Ground Truth Reference:</b>", body_style), Paragraph(eval_record.reference_answer, body_style)])
    
    q_table = Table(q_data, colWidths=[130, 415])
    q_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#ffffff')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#f1f5f9')),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(q_table)
    story.append(Spacer(1, 14))

    # Jury Reasoning Explanations
    story.append(Paragraph("2. Multi-Agent Jury Rationales & Recommendations", h2_style))
    reasons = eval_record.reasons_json or []
    if reasons:
        r_rows = [[Paragraph("<b>Type</b>", body_style), Paragraph("<b>Jury Evaluation Finding / Rationale</b>", body_style)]]
        for r in reasons:
            tag = "<font color='#16a34a'><b>[STRENGTH]</b></font>" if r.get("positive", True) else "<font color='#dc2626'><b>[DEFECT]</b></font>"
            r_rows.append([Paragraph(tag, body_style), Paragraph(r.get("text", ""), body_style)])
        
        r_table = Table(r_rows, colWidths=[90, 455])
        r_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(r_table)
    else:
        story.append(Paragraph("No detailed findings recorded.", body_style))

    story.append(Spacer(1, 14))

    # Claim Verification & Evidence Provenance Table
    story.append(Paragraph("3. Claim-Level Verification & Evidence Grounding", h2_style))
    claims = eval_record.claims or []
    if claims:
        c_rows = [[
            Paragraph("<b>Atomic Claim</b>", body_style),
            Paragraph("<b>Verification Status</b>", body_style),
            Paragraph("<b>Supporting Evidence Excerpt</b>", body_style),
            Paragraph("<b>Source</b>", body_style),
        ]]
        for c in claims:
            status_str = c.status.upper()
            c_color = "#16a34a" if status_str == "SUPPORTED" else ("#d97706" if status_str == "PARTIAL" else "#dc2626")
            c_rows.append([
                Paragraph(c.claim, body_style),
                Paragraph(f"<font color='{c_color}'><b>{status_str}</b></font>", body_style),
                Paragraph(c.evidence or "No direct evidence retrieved.", code_style),
                Paragraph(c.source or "Ground Truth KB", body_style),
            ])
        c_table = Table(c_rows, colWidths=[140, 90, 230, 85])
        c_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('TOPPADDING', (0,0), (-1,-1), 5),
            ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(c_table)
    else:
        story.append(Paragraph("No claim breakdowns available.", body_style))

    # Footer notice
    story.append(Spacer(1, 18))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceAfter=8))
    story.append(Paragraph("<i>Report generated autonomously by VeriAI AI Response Validation System. Strictly audit ready.</i>", ParagraphStyle('Foot', parent=styles['Normal'], fontSize=7.5, textColor=colors.HexColor('#94a3b8'), alignment=1)))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


@router.get("/{id}/export-pdf")
def export_single_pdf(id: str, db: Session = Depends(get_db)):
    """
    M4.2 — Download structured PDF evaluation report for an individual evaluation.
    """
    record = db.query(Evaluation).filter(Evaluation.id == id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    pdf_bytes = generate_pdf_report_bytes(record)
    filename = f"VeriAI_Report_{record.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/batch/{batch_id}/export-pdf")
def export_batch_pdf(batch_id: str, db: Session = Depends(get_db)):
    """
    M4.2 — Download comprehensive structured PDF batch evaluation summary report.
    """
    all_evals = db.query(Evaluation).order_by(Evaluation.created_at.asc()).all()
    evaluations = [
        e for e in all_evals
        if (e.metadata_json or {}).get("batch_id") == batch_id.strip()
    ]
    if not evaluations:
        raise HTTPException(status_code=404, detail=f"No evaluations found for batch ID '{batch_id}'")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle('BTitle', parent=styles['Heading1'], fontSize=18, leading=22, textColor=colors.HexColor('#6d28d9'), spaceAfter=4)
    sub_style = ParagraphStyle('BSub', parent=styles['Normal'], fontSize=9, leading=12, textColor=colors.HexColor('#64748b'), spaceAfter=12)
    h2_style = ParagraphStyle('BH2', parent=styles['Heading2'], fontSize=12, leading=15, textColor=colors.HexColor('#0f172a'), spaceBefore=10, spaceAfter=6)
    body_style = ParagraphStyle('BBody', parent=styles['Normal'], fontSize=9, leading=13, textColor=colors.HexColor('#334155'))

    story = []
    story.append(Paragraph("<b>VeriAI Batch Evaluation Audit Report</b>", title_style))
    story.append(Paragraph(f"Batch ID: <b>{batch_id}</b> | Total Records Evaluated: <b>{len(evaluations)}</b>", sub_style))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=12))

    # Aggregated Summary KPI Table
    pass_cnt = sum(1 for e in evaluations if e.verdict == "PASS")
    rev_cnt = sum(1 for e in evaluations if e.verdict == "REVIEW")
    fail_cnt = sum(1 for e in evaluations if e.verdict == "FAIL")
    avg_score = round(sum(e.overall_score for e in evaluations) / len(evaluations), 1)
    avg_acc = round(sum(e.accuracy_score for e in evaluations) / len(evaluations), 1)
    avg_rel = round(sum(e.relevance_score for e in evaluations) / len(evaluations), 1)
    avg_hall = round(sum(e.hallucination_risk for e in evaluations) / len(evaluations), 1)
    avg_comp = round(sum(e.completeness_score for e in evaluations) / len(evaluations), 1)

    kpi_data = [
        [
            Paragraph("<b>Total Evaluated</b>", body_style),
            Paragraph("<b>Pass / Review / Fail</b>", body_style),
            Paragraph("<b>Avg Overall</b>", body_style),
            Paragraph("<b>Avg Accuracy</b>", body_style),
            Paragraph("<b>Avg Relevance</b>", body_style),
            Paragraph("<b>Avg Hallucination Risk</b>", body_style),
        ],
        [
            Paragraph(f"<b>{len(evaluations)}</b>", body_style),
            Paragraph(f"<font color='#16a34a'><b>{pass_cnt}</b></font> / <font color='#d97706'><b>{rev_cnt}</b></font> / <font color='#dc2626'><b>{fail_cnt}</b></font>", body_style),
            Paragraph(f"<font color='#6d28d9'><b>{avg_score}</b></font>", body_style),
            Paragraph(f"<b>{avg_acc}%</b>", body_style),
            Paragraph(f"<b>{avg_rel}%</b>", body_style),
            Paragraph(f"<b>{avg_hall}%</b>", body_style),
        ]
    ]
    kpi_table = Table(kpi_data, colWidths=[90, 110, 80, 85, 90, 95])
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 14))

    # Table of Individual Item Results
    story.append(Paragraph("Batch Evaluated Item Breakdown", h2_style))
    items_rows = [[
        Paragraph("<b>#</b>", body_style),
        Paragraph("<b>Eval ID</b>", body_style),
        Paragraph("<b>Question Prompt</b>", body_style),
        Paragraph("<b>Verdict</b>", body_style),
        Paragraph("<b>Overall</b>", body_style),
        Paragraph("<b>Acc %</b>", body_style),
        Paragraph("<b>Hall Risk %</b>", body_style),
    ]]
    for idx, e in enumerate(evaluations, 1):
        v_col = "#16a34a" if e.verdict == "PASS" else ("#d97706" if e.verdict == "REVIEW" else "#dc2626")
        items_rows.append([
            Paragraph(str(idx), body_style),
            Paragraph(e.id, body_style),
            Paragraph(e.question[:70] + ("..." if len(e.question) > 70 else ""), body_style),
            Paragraph(f"<font color='{v_col}'><b>{e.verdict}</b></font>", body_style),
            Paragraph(str(e.overall_score), body_style),
            Paragraph(f"{e.accuracy_score}%", body_style),
            Paragraph(f"{e.hallucination_risk}%", body_style),
        ])
    
    items_table = Table(items_rows, colWidths=[25, 75, 230, 65, 50, 50, 55])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(items_table)

    story.append(Spacer(1, 18))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceAfter=8))
    story.append(Paragraph("<i>Batch Audit Report generated by VeriAI AI Response Validation System.</i>", ParagraphStyle('BF', parent=styles['Normal'], fontSize=7.5, textColor=colors.HexColor('#94a3b8'), alignment=1)))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    filename = f"VeriAI_Batch_Report_{batch_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


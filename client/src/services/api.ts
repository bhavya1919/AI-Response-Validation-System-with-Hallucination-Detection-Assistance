/**
 * VeriAI Centralized API Client Service
 * Connects frontend to the FastAPI Multi-Agent RAG evaluation and knowledge services.
 */

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string) || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ClaimItem {
  id: string;
  claim: string;
  status: "supported" | "partial" | "unsupported" | "contradicted" | "incorrect";
  evidenceText: string;
  best_evidence?: string;
  source: string;
  relevance: number;
  note: string;
  similarity?: number;
  confidence?: number;
}

export interface EvidenceItem {
  chunk_id: string;
  source_name: string;
  dataset: string;
  content: string;
  score: number;
  question?: string;
  answer?: string;
}

export interface RelevanceSignals {
  semantic_similarity?: number;
  keyword_coverage?: number;
  topic_alignment?: string;
  matched_concepts?: string[];
  missing_concepts?: string[];
}

export interface RelevanceDetail {
  score: number;
  label: string;
  label_display?: string;
  reasoning: string;
  signals?: RelevanceSignals;
}

export interface AccuracyClaimDetail {
  claim: string;
  status: string;
  similarity: number;
  evidence: string;
}

export interface AccuracyDetail {
  score: number;
  status?: string;
  reasoning: string;
  supported_count?: number;
  partial_count?: number;
  unsupported_count?: number;
  contradicted_count?: number;
  claims: AccuracyClaimDetail[];
}

export interface FlaggedClaim {
  claim: string;
  status: string;
  reasoning: string;
  evidence: string;
}

export interface HallucinationDetail {
  risk_score: number;
  status: string;
  reasoning: string;
  flagged_claims: FlaggedClaim[];
}

export interface CompletenessDetail {
  score: number;
  status?: string;
  reasoning: string;
  addressed_aspects?: string[];
  partial_aspects?: string[];
  covered_aspects?: string[];
  missing_aspects?: string[];
}

export interface VerdictDetail {
  overall_score: number;
  label: string;
  reasoning: string;
  major_strengths?: string[];
  major_issues?: string[];
}

export interface EvaluationRecord {
  id: string;
  title: string;
  question: string;
  aiResponse: string;
  referenceAnswer: string;
  sourceDocument?: string;
  overallScore: number;
  verdict: "PASS" | "REVIEW" | "FAIL";
  confidence: "high" | "medium" | "low";
  evidence_status?: string;
  scores: {
    relevance: number;
    accuracy: number;
    hallucinationRisk: number;
    completeness: number;
  };
  claims: ClaimItem[];
  reasons: { text: string; positive: boolean }[];
  evidence?: EvidenceItem[];
  metadata?: Record<string, any>;
  evaluatedAt: string;

  // Milestone 2 agent breakdowns with reasoning
  relevance?: RelevanceDetail;
  accuracy?: AccuracyDetail;
  hallucination?: HallucinationDetail;
  completeness?: CompletenessDetail;
  verdict_detail?: VerdictDetail;
}

export interface HistoryItem {
  id: string;
  title: string;
  question: string;
  aiResponse: string;
  referenceAnswer: string;
  overallScore: number;
  verdict: "PASS" | "REVIEW" | "FAIL";
  confidence: string;
  evidence_status: string;
  scores: {
    relevance: number;
    accuracy: number;
    hallucinationRisk: number;
    completeness: number;
  };
  evaluatedAt: string;
}

export interface HistoryResponse {
  total: number;
  pass_count: number;
  review_count: number;
  fail_count: number;
  items: HistoryItem[];
}

export interface DashboardStats {
  total_evaluations: number;
  pass_rate: number;
  avg_score?: number;
  avg_accuracy: number;
  avg_relevance: number;
  avg_hallucination_risk: number;
  avg_completeness: number;
  verdict_distribution: {
    PASS: number;
    REVIEW: number;
    FAIL: number;
  };
  score_distribution?: {
    "90_100": number;
    "75_89": number;
    "50_74": number;
    below_50: number;
  };
  hallucination_stats?: {
    responses_with_hallucinations: number;
    hallucination_percentage: number;
    total_unsupported_claims: number;
    total_contradicted_claims: number;
  };
  completeness_distribution?: {
    complete: number;
    partial: number;
    incomplete: number;
    missing_aspects_freq: Record<string, number>;
  };
  top_issues?: {
    issue: string;
    count: number;
    percentage: number;
  }[];
  recent_evaluations: {
    id: string;
    question: string;
    verdict: "PASS" | "REVIEW" | "FAIL";
    score: number;
    accuracy: number;
    hallucinationRisk: number;
    completeness?: number;
    date: string;
  }[];
  kb_stats: {
    sources: number;
    documents: number;
    chunks: number;
    embeddings: number;
  };
}

export interface KnowledgeSearchResult {
  chunk_id: string;
  document_id: string;
  source_id: string;
  source_name: string;
  dataset: string;
  content: string;
  score: number;
  question?: string;
  answer?: string;
  category?: string;
  metadata?: Record<string, any>;
}

// ── Batch Evaluation Types ────────────────────────────────────────────────────

export interface BatchResultItem {
  row: number;
  id?: string;
  question?: string;
  verdict?: "PASS" | "REVIEW" | "FAIL";
  overall_score?: number;
  scores?: {
    relevance: number;
    accuracy: number;
    hallucinationRisk: number;
    completeness: number;
  };
  completeness_status?: string;
  status: "success" | "failed";
  error?: string;
}

export interface BatchSummary {
  pass: number;
  needs_improvement: number;
  fail: number;
  avg_score: number;
  avg_relevance: number;
  avg_accuracy: number;
  avg_hallucination_risk: number;
  avg_completeness: number;
}

export interface BatchUploadResponse {
  batch_id: string;
  started_at: string;
  total_rows: number;
  valid_rows: number;
  failed_rows: number;
  summary: BatchSummary;
  results: BatchResultItem[];
  failed_details: { row: number; reason: string; data: Record<string, string> }[];
}

export interface BatchRun {
  batch_id: string;
  started_at: string;
  total: number;
  pass: number;
  review: number;
  fail: number;
  avg_score: number;
}

// ── API Functions ────────────────────────────────────────────────────────────

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
      ...options,
    });

    if (!res.ok) {
      let errDetail = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) errDetail = errorJson.detail;
      } catch {
        // ignore fallback to generic status
      }
      throw new Error(errDetail);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      throw new Error("Unable to connect to VeriAI backend. Please check your network or server status.");
    }
    throw err;
  }
}

/**
 * Execute full multi-agent evaluation pipeline and persist record to PostgreSQL.
 */
export async function evaluateResponse(params: {
  question: string;
  ai_response: string;
  reference_answer?: string;
  source_document?: string;
  dataset?: string;
  top_k?: number;
}): Promise<EvaluationRecord> {
  const data = await request<any>("/api/evaluate", {
    method: "POST",
    body: JSON.stringify({
      question: params.question,
      ai_response: params.ai_response,
      reference_answer: params.reference_answer || null,
      source_document: params.source_document || null,
      dataset: params.dataset || null,
      top_k: params.top_k || 10,
    }),
  });

  return {
    id: data.id,
    title: data.title,
    question: data.question,
    aiResponse: data.aiResponse,
    referenceAnswer: data.referenceAnswer,
    overallScore: data.overallScore,
    verdict: data.verdict,
    confidence: data.confidence,
    evidence_status: data.evidence_status,
    scores: {
      relevance: data.scores.relevance,
      accuracy: data.scores.accuracy,
      hallucinationRisk: data.scores.hallucinationRisk,
      completeness: data.scores.completeness,
    },
    claims: (data.claims || []).map((c: any) => ({
      id: c.id,
      claim: c.claim,
      status: c.status,
      evidenceText: c.evidenceText || c.best_evidence || "",
      best_evidence: c.best_evidence || c.evidenceText || "",
      source: c.source || "Ground Truth",
      relevance: c.relevance || 0,
      note: c.note || "",
      similarity: c.similarity || 0,
      confidence: c.confidence || 0,
    })),
    reasons: data.reasons || [],
    evidence: (data.evidence || []).map((e: any) => ({
      chunk_id: e.chunk_id,
      source_name: e.source_name,
      dataset: e.dataset,
      content: e.content,
      score: e.score,
      question: e.question,
      answer: e.answer,
    })),
    metadata: data.metadata || {},
    evaluatedAt: data.evaluatedAt || "Just now",
    relevance: data.relevance || undefined,
    accuracy: data.accuracy || undefined,
    hallucination: data.hallucination || undefined,
    completeness: data.completeness || undefined,
    verdict_detail: data.verdict_detail || undefined,
  };
}

/**
 * Retrieve a previously saved evaluation from PostgreSQL.
 */
export async function getEvaluation(id: string): Promise<EvaluationRecord> {
  const data = await request<any>(`/api/evaluate/${id}`);
  return {
    id: data.id,
    title: data.title,
    question: data.question,
    aiResponse: data.aiResponse,
    referenceAnswer: data.referenceAnswer,
    overallScore: data.overallScore,
    verdict: data.verdict,
    confidence: data.confidence,
    evidence_status: data.evidence_status,
    scores: data.scores,
    claims: data.claims || [],
    reasons: data.reasons || [],
    evidence: data.evidence || [],
    metadata: data.metadata || {},
    evaluatedAt: data.evaluatedAt,
    relevance: data.relevance || undefined,
    accuracy: data.accuracy || undefined,
    hallucination: data.hallucination || undefined,
    completeness: data.completeness || undefined,
    verdict_detail: data.verdict_detail || undefined,
  };
}

/**
 * Fetch evaluation history from PostgreSQL.
 */
export async function getEvaluationHistory(params?: {
  verdict?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<HistoryResponse> {
  const searchParams = new URLSearchParams();
  if (params?.verdict && params.verdict !== "ALL") searchParams.set("verdict", params.verdict);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));

  const queryStr = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return await request<HistoryResponse>(`/api/evaluate/history${queryStr}`);
}

/**
 * Fetch real aggregated statistics for the Dashboard and Analytics.
 */
export async function getDashboardStats(params?: {
  batch_id?: string;
  verdict?: string;
}): Promise<DashboardStats> {
  const searchParams = new URLSearchParams();
  if (params?.batch_id) searchParams.set("batch_id", params.batch_id);
  if (params?.verdict && params.verdict !== "ALL") searchParams.set("verdict", params.verdict);
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
  return await request<DashboardStats>(`/api/evaluate/stats/dashboard${qs}`);
}

/**
 * Trigger browser file download for a single evaluation PDF report.
 */
export function getSinglePDFUrl(id: string): string {
  return `${API_BASE_URL}/api/evaluate/${id}/export-pdf`;
}

/**
 * Trigger browser file download for a batch evaluation PDF report.
 */
export function getBatchPDFUrl(batchId: string): string {
  return `${API_BASE_URL}/api/evaluate/batch/${batchId}/export-pdf`;
}

/**
 * Perform semantic vector search over the knowledge base.
 */
export async function searchKnowledgeBase(params: {
  query: string;
  dataset?: string;
  top_k?: number;
  threshold?: number;
}): Promise<KnowledgeSearchResult[]> {
  return await request<KnowledgeSearchResult[]>("/api/knowledge/search", {
    method: "POST",
    body: JSON.stringify({
      query: params.query,
      dataset: params.dataset || null,
      top_k: params.top_k || 8,
      threshold: params.threshold || 0.0,
    }),
  });
}

/**
 * Retrieve knowledge base ingestion and source statistics.
 */
export async function getKnowledgeBaseStats(): Promise<any> {
  return await request<any>("/api/knowledge/ingest/stats");
}

/**
 * Delete a saved evaluation from PostgreSQL.
 */
export async function deleteEvaluation(id: string): Promise<{ status: string }> {
  return await request<{ status: string }>(`/api/evaluate/${id}`, {
    method: "DELETE",
  });
}

// ── Batch Evaluation API ─────────────────────────────────────────────────────

/**
 * Upload a CSV file for batch evaluation through the multi-agent pipeline.
 */
export async function uploadBatchEvaluation(
  file: File,
  options?: { referenceColumn?: string; topK?: number }
): Promise<BatchUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams();
  if (options?.referenceColumn) params.set("reference_column", options.referenceColumn);
  if (options?.topK) params.set("top_k", String(options.topK));
  const qs = params.toString() ? `?${params.toString()}` : "";
  const url = `${API_BASE_URL}/api/evaluate/batch${qs}`;
  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const j = await res.json(); if (j.detail) detail = j.detail; } catch {}
    throw new Error(detail);
  }
  return (await res.json()) as BatchUploadResponse;
}

/**
 * Fetch list of past batch runs.
 */
export async function getBatchHistory(limit = 20): Promise<{ batches: BatchRun[] }> {
  return await request<{ batches: BatchRun[] }>(`/api/evaluate/batch/history?limit=${limit}`);
}

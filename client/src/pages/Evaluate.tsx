import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Download,
  FileCheck2,
  FileText,
  HelpCircle,
  Info,
  Loader2,
  Play,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useEvaluation } from "@/contexts/EvaluationContext";
import { evaluateResponse, type EvaluationRecord, type ClaimItem, type EvidenceItem } from "@/services/api";
import { toast } from "sonner";

export default function Evaluate() {
  const [location, setLocation] = useLocation();
  const { currentEvaluation, setCurrentEvaluation, isEvaluating, evaluationStepText, runCustomEvaluation, loadEvaluationById } = useEvaluation();

  // Form states
  const [question, setQuestion] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [referenceAnswer, setReferenceAnswer] = useState("");
  const [sourceDocument, setSourceDocument] = useState("");
  const [selectedDataset, setSelectedDataset] = useState<string>("all");
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  // Result display state
  const [result, setResult] = useState<EvaluationRecord | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);
  const [claimFilter, setClaimFilter] = useState<"all" | "supported" | "partial" | "unsupported" | "contradicted">("all");
  const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({
    verdict: true,
    relevance: true,
    accuracy: true,
    hallucination: true,
    completeness: true,
  });

  const toggleAgent = (key: string) => {
    setExpandedAgents((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Check URL query parameters for ?id= to load previously saved evaluation
  useEffect(() => {
    const queryStr = window.location.search || (location.includes("?") ? location.substring(location.indexOf("?")) : "");
    const params = new URLSearchParams(queryStr);
    const evalId = params.get("id");
    if (evalId) {
      loadEvaluationById(evalId)
        .then((rec) => {
          setResult(rec);
          setQuestion(rec.question);
          setAiResponse(rec.aiResponse);
          setReferenceAnswer(rec.referenceAnswer || "");
          setTimeout(() => {
            const el = document.getElementById("evaluation-result");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }, 150);
        })
        .catch((err) => {
          console.error("Failed to load evaluation from URL:", err);
          toast.error("Could not load requested evaluation.");
        });
    }
  }, [location]);

  // Quick preset scenarios to test
  const applyPreset = (preset: {
    q: string;
    r: string;
    ref?: string;
    ds?: string;
  }) => {
    setQuestion(preset.q);
    setAiResponse(preset.r);
    setReferenceAnswer(preset.ref || "");
    setSourceDocument("");
    setSelectedDataset(preset.ds || "all");
    setEvalError(null);
    toast.info("Scenario pre-filled into form.");
  };

  const handleClear = () => {
    setQuestion("");
    setAiResponse("");
    setReferenceAnswer("");
    setSourceDocument("");
    setResult(null);
    setEvalError(null);
  };

  const handleRunEvaluation = async () => {
    if (!question.trim()) {
      toast.error("Question is required.");
      return;
    }
    if (!aiResponse.trim()) {
      toast.error("AI generated response is required.");
      return;
    }

    setEvalError(null);
    try {
      const evaluationResult = await runCustomEvaluation({
        question: question.trim(),
        aiResponse: aiResponse.trim(),
        referenceAnswer: referenceAnswer.trim() || undefined,
        sourceDocument: sourceDocument.trim() || undefined,
        dataset: selectedDataset !== "all" ? selectedDataset : undefined,
      });
      setResult(evaluationResult);
      toast.success("Evaluation completed and saved to PostgreSQL.");
    } catch (err: any) {
      const msg = err.message || "Evaluation could not be completed.";
      setEvalError(msg);
      toast.error(msg);
    }
  };

  const handleCopyEvidence = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Evidence excerpt copied to clipboard.");
  };

  const handleCopyCitation = (source: string, dataset: string, chunkId: string) => {
    const citation = `[Source: ${source} | Dataset: ${dataset} | Chunk ID: ${chunkId}]`;
    navigator.clipboard.writeText(citation);
    toast.success("Citation reference copied to clipboard.");
  };

  const handleExportJSON = () => {
    if (!result) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `veriai-evaluation-${result.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Exported evaluation result as JSON.");
  };

  const handlePrint = () => {
    window.print();
  };

  // Status badge styling helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "supported":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={12} /> SUPPORTED
          </span>
        );
      case "partial":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
            <AlertCircle size={12} /> PARTIAL
          </span>
        );
      case "unsupported":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
            <XCircle size={12} /> UNSUPPORTED
          </span>
        );
      case "contradicted":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700">
            <ShieldAlert size={12} /> CONTRADICTED
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 uppercase">
            {status}
          </span>
        );
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "PASS":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
            <CheckCircle2 size={16} /> PASS
          </span>
        );
      case "REVIEW":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
            <AlertCircle size={16} /> REVIEW
          </span>
        );
      case "FAIL":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-100 px-3 py-1 text-sm font-bold text-rose-800">
            <XCircle size={16} /> FAIL
          </span>
        );
      default:
        return <span>{verdict}</span>;
    }
  };

  // Hallucination risk categorization
  const getHallucinationLevel = (risk: number) => {
    if (risk <= 15) return { label: "LOW", color: "text-[#16a34a]", bg: "bg-emerald-50 border-emerald-200" };
    if (risk <= 40) return { label: "MODERATE", color: "text-amber-600", bg: "bg-amber-50 border-amber-200" };
    if (risk <= 70) return { label: "HIGH", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" };
    return { label: "CRITICAL", color: "text-rose-600", bg: "bg-rose-50 border-rose-200" };
  };

  // Student-friendly summary helpers
  const getRelevanceSummary = (score: number, label?: string): string => {
    if (score >= 90) {
      return "The response directly and thoroughly answers the question without getting sidetracked by unnecessary or unrelated details.";
    }
    if (score >= 70) {
      return "The response directly addresses the question but includes some additional information that is not strictly necessary.";
    }
    if (score >= 50) {
      return "The response partially addresses the question, but leaves out key parts of the answer or includes extraneous material.";
    }
    if (score >= 25) {
      return "The response only weakly connects to the topic and does not clearly answer what was asked.";
    }
    return "The response does not address the question and is completely off-topic.";
  };

  const getAccuracySummary = (score: number, supported: number, partial: number, unsupported: number, contradicted: number): string => {
    if (contradicted > 0) {
      return `One or more claims directly contradict verified facts in the reference knowledge base (${contradicted} contradicted statement${contradicted > 1 ? "s" : ""}).`;
    }
    if (score >= 80 && unsupported === 0 && partial === 0) {
      return `All factual claims (${supported}/${supported}) are verified and agree with the retrieved evidence.`;
    }
    if (score >= 50) {
      if (partial > 0 && unsupported === 0) {
        return `Most of the claims agree with the retrieved evidence, but ${partial} claim${partial > 1 ? "s are" : " is"} only partially supported.`;
      }
      return `Most of the claims agree with the retrieved evidence, but some claims lack sufficient supporting evidence.`;
    }
    return `The response contains multiple unverified assertions (${unsupported} unsupported) that could not be corroborated by reference sources.`;
  };

  const getHallucinationSummary = (riskScore: number, flaggedCount: number): string => {
    if (riskScore <= 15) {
      return "All statements are corroborated by verified reference knowledge. No hallucinated or conflicting assertions detected.";
    }
    if (riskScore <= 35) {
      return `Moderate risk (${riskScore}%). Most statements are grounded, but ${flaggedCount} claim${flaggedCount > 1 ? "s" : ""} could not be fully substantiated by retrieved evidence.`;
    }
    if (riskScore <= 60) {
      return `High risk (${riskScore}%). Multiple assertions (${flaggedCount} flagged) lack evidence backing in the knowledge base and may be inaccurate.`;
    }
    return `Critical risk (${riskScore}%). High likelihood of fabricated claims or direct contradictions against canonical facts.`;
  };

  const getCompletenessSummary = (score: number, covered: string[], missing: string[]): string => {
    if (score >= 80) {
      return "The response comprehensively covers the essential concepts and facets requested by the question.";
    }
    if (score >= 50) {
      return `The response covers major aspects but omits some key facets${missing.length > 0 ? ` (e.g., ${missing.slice(0, 3).join(", ")})` : ""}.`;
    }
    return "The response leaves most key question aspects unaddressed, providing only limited coverage.";
  };

  // Visual score bar component
  const ScoreBar = ({ score, max = 100, color = "#6d28d9" }: { score: number; max?: number; color?: string }) => {
    const pct = Math.min(100, Math.max(0, (score / max) * 100));
    return (
      <div className="w-full h-2 rounded-full bg-[#ece5f4] overflow-hidden mt-1.5">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    );
  };

  const filteredClaims = (result?.claims || []).filter((c) => {
    if (claimFilter === "all") return true;
    return c.status === claimFilter;
  });

  return (
    <AppLayout
      eyebrow="Evaluation Studio"
      title="Evaluate AI Response"
      subtitle="Enter the question and the AI-generated response you want VeriAI to validate against canonical knowledge bases."
    >
      {/* Scenario Presets Bar */}
      <div className="mb-6 rounded-2xl border border-[#ece5f4] bg-white p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#797184]">
            Pre-configured Scenarios
          </span>
          <span className="text-[11px] text-[#8e8699]">
            Click to fill realistic test cases
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              applyPreset({
                q: "What is photosynthesis?",
                r: "Photosynthesis is the process by which plants use light energy to convert carbon dioxide and water into chemical energy, releasing oxygen.",
                ref: "Photosynthesis is the process by which green plants and certain other organisms transform light energy into chemical energy, converting water and carbon dioxide into oxygen and carbohydrates.",
                ds: "all",
              })
            }
            className="rounded-full border border-[#ded5ea] bg-[#faf8fd] px-3.5 py-1.5 text-xs font-semibold text-[#484054] transition hover:border-[#6d28d9] hover:bg-white"
          >
            🌱 Photosynthesis (Ground Truth)
          </button>
          <button
            type="button"
            onClick={() =>
              applyPreset({
                q: "What exact words did Neil Armstrong say on the moon?",
                r: "That's one small step for a man, one giant leap for mankind.",
                ref: "That's one small step for a man, one giant leap for mankind",
                ds: "truthfulqa",
              })
            }
            className="rounded-full border border-[#ded5ea] bg-[#faf8fd] px-3.5 py-1.5 text-xs font-semibold text-[#484054] transition hover:border-[#6d28d9] hover:bg-white"
          >
            🚀 Neil Armstrong Quote (TruthfulQA)
          </button>
          <button
            type="button"
            onClick={() =>
              applyPreset({
                q: "When did the Scholastic Magazine of Notre Dame begin publishing?",
                r: "The Scholastic Magazine began publishing in 1999 following the invention of the internet.",
                ref: "September 1876",
                ds: "squad",
              })
            }
            className="rounded-full border border-[#ded5ea] bg-[#faf8fd] px-3.5 py-1.5 text-xs font-semibold text-[#484054] transition hover:border-[#6d28d9] hover:bg-white"
          >
            ⚠ Misconception / Factual Error
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#cfc4e2] px-3 py-1.5 text-xs font-semibold text-[#6d28d9] hover:bg-[#f6f2fd]"
          >
            <RotateCcw size={12} /> Clear Form
          </button>
        </div>
      </div>

      {/* Main Studio Input Form */}
      <div className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm sm:p-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunEvaluation();
          }}
          className="space-y-5"
        >
          {/* Question Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#635c6f] mb-1.5">
              Question <span className="text-[#dc2626]">*</span>
            </label>
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., What is photosynthesis?"
              className="w-full rounded-xl border border-[#ded7e8] bg-[#fbfafc] p-3 text-xs leading-5 text-[#17151c] outline-none transition focus:border-[#6d28d9] focus:bg-white focus:ring-2 focus:ring-[#6d28d9]/10"
            />
          </div>

          {/* AI Generated Response Field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#635c6f] mb-1.5">
              AI Generated Response <span className="text-[#dc2626]">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={aiResponse}
              onChange={(e) => setAiResponse(e.target.value)}
              placeholder="Enter the AI-generated response you want VeriAI to validate..."
              className="w-full rounded-xl border border-[#ded7e8] bg-[#fbfafc] p-3.5 text-xs leading-relaxed text-[#17151c] outline-none transition focus:border-[#6d28d9] focus:bg-white focus:ring-2 focus:ring-[#6d28d9]/10"
            />
          </div>

          {/* Knowledge Base Selection */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#ede7f5] bg-[#faf8fd] p-3.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#564e62]">
              <Database size={15} className="text-[#6d28d9]" />
              <span>Select Knowledge Base:</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "All Datasets (Multi-Hop)" },
                { id: "squad", label: "SQuAD v1.1" },
                { id: "truthfulqa", label: "TruthfulQA" },
                { id: "custom", label: "Custom Documents" },
              ].map((kb) => (
                <button
                  type="button"
                  key={kb.id}
                  onClick={() => setSelectedDataset(kb.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    selectedDataset === kb.id
                      ? "bg-[#6d28d9] text-white shadow-xs"
                      : "bg-white text-[#635c6f] border border-[#ded5ea] hover:bg-[#f6f2fd]"
                  }`}
                >
                  {kb.label}
                </button>
              ))}
            </div>
          </div>

          {/* Toggle Optional Fields */}
          <div>
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6d28d9] hover:underline"
            >
              {showOptionalFields ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              {showOptionalFields ? "Hide Optional Grounding Inputs" : "Show Optional Reference Answer & Source Document"}
            </button>
          </div>

          {/* Optional Inputs Container */}
          {showOptionalFields && (
            <div className="space-y-4 rounded-2xl border border-[#ece5f4] bg-[#fcfbfe] p-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#756e80] mb-1">
                  Reference Answer (Optional)
                </label>
                <p className="text-[11px] text-[#8c8498] mb-1.5">
                  If provided, VeriAI validates the AI response directly against this canonical ground truth as well as the vector knowledge base.
                </p>
                <input
                  type="text"
                  value={referenceAnswer}
                  onChange={(e) => setReferenceAnswer(e.target.value)}
                  placeholder="e.g., Photosynthesis converts water and CO2 into glucose..."
                  className="w-full rounded-xl border border-[#ded7e8] bg-white p-2.5 text-xs text-[#17151c] outline-none focus:border-[#6d28d9]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#756e80] mb-1">
                  Source Document (Optional)
                </label>
                <p className="text-[11px] text-[#8c8498] mb-1.5">
                  Supply custom reference text to ground the response against organizational material or specific policy guidelines.
                </p>
                <textarea
                  rows={3}
                  value={sourceDocument}
                  onChange={(e) => setSourceDocument(e.target.value)}
                  placeholder="Paste custom documentation or reference paragraph here..."
                  className="w-full rounded-xl border border-[#ded7e8] bg-white p-2.5 text-xs leading-relaxed text-[#17151c] outline-none focus:border-[#6d28d9]"
                />
              </div>
            </div>
          )}

          {/* Truthful Progress State */}
          {isEvaluating && (
            <div className="rounded-2xl border border-[#d4c5ec] bg-[#f7f2fe] p-5">
              <div className="flex items-center gap-3">
                <Loader2 size={20} className="animate-spin text-[#6d28d9]" />
                <div>
                  <div className="font-display text-xs font-bold text-[#1f192b]">
                    VeriAI is evaluating your response...
                  </div>
                  <div className="mt-0.5 text-xs text-[#6e667c]">
                    Retrieving evidence via pgvector, analyzing sentence-level claims, computing hallucination risk, and synthesizing jury verdict.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {evalError && !isEvaluating && (
            <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-900 flex items-start gap-2.5">
              <AlertCircle size={17} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Evaluation failed:</strong>
                <span>{evalError}</span>
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between border-t border-[#ede7f4] pt-4">
            <span className="text-[11px] text-[#847c91]">
              Factual claims and evidence citations are stored in PostgreSQL.
            </span>

            <button
              type="submit"
              disabled={isEvaluating || !question.trim() || !aiResponse.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-[#6d28d9] px-6 py-3 text-xs font-bold text-white shadow-md shadow-[#6d28d9]/30 transition hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isEvaluating ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Evaluating...
                </>
              ) : (
                <>
                  <Play size={14} /> Run Evaluation
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* EVALUATION RESULT DISPLAY */}
      {/* ========================================================================= */}
      {result && !isEvaluating && (
        <div id="evaluation-result" className="mt-10 space-y-8">
          {/* Header Card with Overall Score and Verdict */}
          <section className="rounded-3xl border border-[#d9ceea] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#f0ebf7] pb-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#7c7488]">
                  Evaluation Result (ID: {result.id})
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold text-[#17151c] sm:text-3xl">
                  {result.title}
                </h2>
                <div className="mt-1 text-xs text-[#746c80]">
                  Evaluated at {result.evaluatedAt} · Grounding mode: {result.metadata?.grounding_mode || "KB"}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleClear();
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#6d28d9] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#5b21b6]"
                >
                  <RotateCcw size={13} /> New Evaluation
                </button>
                <button
                  type="button"
                  onClick={() => setLocation("/history")}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ded5ea] bg-white px-3.5 py-1.5 text-xs font-bold text-[#564e62] hover:bg-[#f6f2fd] hover:text-[#6d28d9]"
                >
                  <Clock size={13} /> View History
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ded5ea] bg-white px-3.5 py-1.5 text-xs font-bold text-[#564e62] hover:bg-[#f6f2fd] hover:text-[#6d28d9]"
                >
                  <Download size={13} /> Export JSON
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ded5ea] bg-white px-3.5 py-1.5 text-xs font-bold text-[#564e62] hover:bg-[#f6f2fd] hover:text-[#6d28d9]"
                >
                  <Printer size={13} /> Print / PDF
                </button>
              </div>
            </div>

            {/* Quick Section Navigation Jump Bar */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#f0ebf7] pt-3 text-[11px] font-semibold text-[#71697e]">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8a8296] mr-1">Quick Jump:</span>
              <a
                href="#agent-breakdown"
                className="inline-flex items-center gap-1 rounded-full border border-[#e4dbf0] bg-white px-3 py-1 text-[#5b5168] hover:border-[#6d28d9] hover:text-[#6d28d9]"
              >
                📊 4-Agent Breakdown
              </a>
              <a
                href="#claims-analysis"
                className="inline-flex items-center gap-1 rounded-full border border-[#e4dbf0] bg-white px-3 py-1 text-[#5b5168] hover:border-[#6d28d9] hover:text-[#6d28d9]"
              >
                🔍 Verified Claims ({result.claims.length})
              </a>
              <a
                href="#retrieved-evidence"
                className="inline-flex items-center gap-1 rounded-full border border-[#e4dbf0] bg-white px-3 py-1 text-[#5b5168] hover:border-[#6d28d9] hover:text-[#6d28d9]"
              >
                📚 Retrieved Evidence ({result.evidence?.length || 0})
              </a>
            </div>

            {/* Verdict and Score Row */}
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
              {/* Overall Score */}
              <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-5 text-center flex flex-col justify-center items-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b8398]">
                  Overall VeriAI Score
                </span>
                <div className="mt-2 font-display text-5xl font-bold text-[#6d28d9]">
                  {result.overallScore}
                  <span className="text-xl text-[#9b93a8]"> / 100</span>
                </div>
                <span className="mt-2 text-xs font-semibold text-[#665e72]">
                  Confidence: <span className="capitalize font-bold text-[#17151c]">{result.confidence}</span>
                </span>
              </div>

              {/* Verdict Card */}
              <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-5 text-center flex flex-col justify-center items-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b8398]">
                  Jury Verdict
                </span>
                <div className="mt-3">{getVerdictBadge(result.verdict)}</div>
                <p className="mt-3 text-xs text-[#71697e] max-w-xs">
                  {result.verdict === "PASS"
                    ? "Verified against canonical knowledge base. High factual precision."
                    : result.verdict === "REVIEW"
                    ? "Factual claims require human review or lack direct evidence."
                    : "Severe factual inconsistencies, contradictions, or unsupported claims detected."}
                </p>
              </div>

              {/* Hallucination Level Card */}
              <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-5 text-center flex flex-col justify-center items-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b8398]">
                  Hallucination Risk Level
                </span>
                <div className={`mt-2 font-display text-4xl font-bold ${getHallucinationLevel(result.scores.hallucinationRisk).color}`}>
                  {(result.hallucination?.status || getHallucinationLevel(result.scores.hallucinationRisk).label).toUpperCase()}
                </div>
                <span className="mt-2 text-xs font-bold text-[#625a6f]">
                  Risk Score: {result.hallucination?.risk_score ?? result.scores.hallucinationRisk}%
                </span>
              </div>
            </div>

            {/* Final Verdict Contributing Explanation Banner */}
            <div className="mt-6 rounded-2xl border border-[#ded5ea] bg-gradient-to-br from-[#faf8fd] to-white p-5">
              <div className="flex items-center justify-between gap-3 border-b border-[#eee8f6] pb-3">
                <div className="flex items-center gap-2">
                  <div className="grid size-7 place-items-center rounded-lg bg-[#6d28d9] text-white">
                    <ShieldCheck size={16} />
                  </div>
                  <span className="text-xs font-bold text-[#1e1828]">
                    Final Verdict Synthesis & Contributing Agent Rationale
                  </span>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#736a80]">
                  Verdict: <strong className="text-[#6d28d9]">{result.verdict}</strong> ({result.overallScore}/100)
                </span>
              </div>

              <div className="mt-3 text-xs leading-relaxed text-[#352e42] bg-white rounded-xl border border-[#ece6f5] p-3.5 font-medium">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#6d28d9] mb-1">
                  Why this verdict?
                </span>
                {result.verdict_detail?.reasoning || (
                  result.verdict === "PASS"
                    ? "The response is directly relevant and factually accurate, with key claims strongly supported by verified evidence, resulting in low hallucination risk."
                    : result.verdict === "REVIEW"
                    ? "The response is relevant and mostly accurate, but some claims lack sufficient supporting evidence, resulting in moderate hallucination risk."
                    : "The response failed evaluation due to low accuracy and elevated hallucination risk."
                )}
              </div>

              {/* Contributing reasons list */}
              {result.reasons && result.reasons.length > 0 && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.reasons.map((r, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-2 rounded-xl border p-2.5 text-[11px] leading-relaxed ${
                        r.positive
                          ? "border-emerald-200 bg-emerald-50/40 text-emerald-900"
                          : "border-amber-200 bg-amber-50/40 text-amber-900"
                      }`}
                    >
                      <span className="mt-0.5 shrink-0">
                        {r.positive ? (
                          <Check size={14} className="text-emerald-700" />
                        ) : (
                          <AlertTriangle size={14} className="text-amber-700" />
                        )}
                      </span>
                      <span>{r.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* M3.2: Major Strengths & Issues */}
              {(result.verdict_detail?.major_strengths || result.verdict_detail?.major_issues) && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(result.verdict_detail.major_strengths ?? []).length > 0 && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-2">
                        ✅ Major Strengths
                      </span>
                      <ul className="space-y-1.5">
                        {(result.verdict_detail.major_strengths ?? []).map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-emerald-900 font-medium">
                            <Check size={12} className="text-emerald-600 mt-0.5 shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(result.verdict_detail.major_issues ?? []).length > 0 && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/30 p-4">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-700 mb-2">
                        ⚠ Major Issues
                      </span>
                      <ul className="space-y-1.5">
                        {(result.verdict_detail.major_issues ?? []).map((issue, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-rose-900 font-medium">
                            <XCircle size={12} className="text-rose-600 mt-0.5 shrink-0" />
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── AGENT SCORES VISUAL SUMMARY BAR ── */}
            <div className="mt-6 rounded-2xl border border-[#ede7f5] bg-white p-5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#7c7488] mb-3">
                Agent Score Overview
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Relevance", score: result.scores.relevance, color: "#6d28d9", icon: "🎯" },
                  { label: "Accuracy", score: result.scores.accuracy, color: "#16a34a", icon: "✓" },
                  { label: "Hallucination Risk", score: result.scores.hallucinationRisk, color: result.scores.hallucinationRisk > 40 ? "#dc2626" : result.scores.hallucinationRisk > 15 ? "#d97706" : "#16a34a", icon: "⚠" },
                  { label: "Completeness", score: result.scores.completeness, color: "#2563eb", icon: "📋" },
                ].map((dim) => (
                  <div key={dim.label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#4a4255]">
                        {dim.icon} {dim.label}
                      </span>
                      <span className="text-xs font-bold" style={{ color: dim.color }}>
                        {dim.label === "Hallucination Risk" ? `${dim.score}%` : `${dim.score}/100`}
                      </span>
                    </div>
                    <ScoreBar score={dim.score} color={dim.color} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ========================================================================= */}
          {/* MULTI-AGENT EVALUATION BREAKDOWN: EXPANDABLE CARDS */}
          {/* ========================================================================= */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-bold text-[#17151c]">
                  Multi-Agent Score Breakdown & Detailed Reasoning
                </h3>
                <p className="text-xs text-[#756e81]">
                  Expand each evaluation dimension below to understand the deterministic signals and evidence behind every agent score.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedAgents({
                      verdict: true,
                      relevance: true,
                      accuracy: true,
                      hallucination: true,
                      completeness: true,
                    })
                  }
                  className="rounded-full border border-[#ded5ea] bg-white px-3 py-1 text-[11px] font-bold text-[#625971] hover:bg-[#faf7fd] hover:text-[#6d28d9]"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedAgents({
                      verdict: false,
                      relevance: false,
                      accuracy: false,
                      hallucination: false,
                      completeness: false,
                    })
                  }
                  className="rounded-full border border-[#ded5ea] bg-white px-3 py-1 text-[11px] font-bold text-[#625971] hover:bg-[#faf7fd] hover:text-[#6d28d9]"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {/* ── CARD 1: RELEVANCE AGENT ── */}
            {(() => {
              const relScore = result.relevance?.score ?? result.scores.relevance;
              const relLabel =
                result.relevance?.label_display ||
                result.relevance?.label ||
                (relScore >= 90
                  ? "Fully Relevant"
                  : relScore >= 70
                  ? "Mostly Relevant"
                  : relScore >= 50
                  ? "Partially Relevant"
                  : "Mostly Irrelevant");
              const relReasoning =
                result.relevance?.reasoning ||
                (relScore >= 70
                  ? "The response directly answers the question with relevant focus and minor extraneous detail."
                  : "The response exhibits limited topical overlap with the question scope.");
              const signals = result.relevance?.signals;
              const isExpanded = !!expandedAgents.relevance;

              return (
                <div className="rounded-3xl border border-[#ece5f4] bg-white shadow-xs overflow-hidden transition hover:border-[#6d28d9]/40">
                  <button
                    type="button"
                    onClick={() => toggleAgent("relevance")}
                    className="flex w-full items-center justify-between p-5 text-left bg-[#fdfcfe] hover:bg-[#faf8fd] transition border-b border-[#f1ecf7]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="grid size-10 place-items-center rounded-2xl bg-[#6d28d9]/10 text-[#6d28d9]">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-bold text-[#17151c]">
                            1. Relevance Agent
                          </span>
                          <span className="rounded-full border border-[#ded5ea] bg-[#faf8fd] px-2.5 py-0.5 text-[11px] font-bold text-[#6d28d9]">
                            {relLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[#787184] line-clamp-1">
                          Evaluates direct topical alignment, question coverage, and evasion avoidance.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 ml-3">
                      <div className="text-right">
                        <div className="font-display text-xl font-bold text-[#6d28d9]">
                          {relScore} <span className="text-xs text-[#9b93a8]">/ 100</span>
                        </div>
                        <span className="text-[10px] font-semibold text-[#81798e]">Relevance Score</span>
                      </div>
                      <div className="grid size-8 place-items-center rounded-full border border-[#ded5ea] bg-white text-[#655d71]">
                        {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-6 space-y-5 bg-white text-xs">
                      {/* Score progress bar */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-[#4a4255]">Relevance Score</span>
                            <span className="text-sm font-bold text-[#6d28d9]">{relScore}/100</span>
                          </div>
                          <ScoreBar score={relScore} color="#6d28d9" />
                        </div>
                      </div>

                      {/* Student-friendly summary */}
                      <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1.5">
                          📖 In Simple Terms
                        </span>
                        <p className="text-xs leading-relaxed text-blue-900 font-medium">
                          {getRelevanceSummary(relScore, result.relevance?.label)}
                        </p>
                      </div>

                      {/* Why this score? */}
                      <div className="rounded-2xl border border-[#ede7f5] bg-[#faf8fd] p-4">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#6d28d9] mb-1.5">
                          🔬 DETAILED REASONING
                        </span>
                        <p className="text-xs leading-relaxed text-[#231d2c] font-medium">
                          {relReasoning}
                        </p>
                      </div>

                      {/* Evaluation signals */}
                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[#736c7f] mb-2.5">
                          Evaluation Signals & Metric Details
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="rounded-2xl border border-[#eee8f6] bg-white p-3.5 shadow-2xs">
                            <span className="text-[10px] font-bold uppercase text-[#8a8296] block">
                              • Semantic Relevance
                            </span>
                            <div className="mt-1 text-sm font-bold text-[#1a1622]">
                              {signals?.semantic_similarity !== undefined
                                ? `${(signals.semantic_similarity * 100).toFixed(0)}%`
                                : `${relScore}%`}{" "}
                              <span className="text-xs font-normal text-[#81798f]">vector similarity</span>
                            </div>
                            <span className="mt-1 block text-[10px] text-[#81798f]">
                              Calibrated dense vector cosine proximity
                            </span>
                          </div>

                          <div className="rounded-2xl border border-[#eee8f6] bg-white p-3.5 shadow-2xs">
                            <span className="text-[10px] font-bold uppercase text-[#8a8296] block">
                              • Question Coverage
                            </span>
                            <div className="mt-1 text-sm font-bold text-[#1a1622]">
                              {signals?.keyword_coverage !== undefined
                                ? `${(signals.keyword_coverage * 100).toFixed(0)}%`
                                : `${result.scores.completeness}%`}{" "}
                              <span className="text-xs font-normal text-[#81798f]">concept match</span>
                            </div>
                            <span className="mt-1 block text-[10px] text-[#81798f]">
                              Fraction of core inquiry terms addressed
                            </span>
                          </div>

                          <div className="rounded-2xl border border-[#eee8f6] bg-white p-3.5 shadow-2xs">
                            <span className="text-[10px] font-bold uppercase text-[#8a8296] block">
                              • Topic Alignment
                            </span>
                            <div className="mt-1 text-sm font-bold capitalize text-[#6d28d9]">
                              {signals?.topic_alignment || (relScore >= 70 ? "High Alignment" : "Partial Alignment")}
                            </div>
                            <span className="mt-1 block text-[10px] text-[#81798f]">
                              Topical focus without off-topic drift
                            </span>
                          </div>
                        </div>

                        {/* Concept Pills */}
                        {signals && (((signals.matched_concepts?.length ?? 0) > 0) || ((signals.missing_concepts?.length ?? 0) > 0)) && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 pt-1">
                            {signals.matched_concepts?.map((kw: string, i: number) => (
                              <span
                                key={`m-${i}`}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800"
                              >
                                <Check size={10} /> {kw}
                              </span>
                            ))}
                            {signals.missing_concepts?.map((kw: string, i: number) => (
                              <span
                                key={`x-${i}`}
                                className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800"
                              >
                                Missing: {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── CARD 2: ACCURACY AGENT ── */}
            {(() => {
              const accScore = result.accuracy?.score ?? result.scores.accuracy;
              const accStatus =
                result.accuracy?.status ||
                (accScore >= 80
                  ? "Verified Correct"
                  : accScore >= 50
                  ? "Partially Correct"
                  : result.claims.some((c) => c.status === "contradicted" || c.status === "incorrect")
                  ? "Factual Inaccuracies Detected"
                  : "Unverified Assertions");
              const accReasoning =
                result.accuracy?.reasoning ||
                (accScore >= 80
                  ? "High accuracy score. All factual claims are corroborated by verified ground truth."
                  : "Moderate accuracy score. Some factual claims lack direct grounding in verified evidence.");
              const suppCount =
                result.accuracy?.supported_count ??
                result.claims.filter((c) => c.status === "supported").length;
              const partCount =
                result.accuracy?.partial_count ??
                result.claims.filter((c) => c.status === "partial").length;
              const unsuppCount =
                result.accuracy?.unsupported_count ??
                result.claims.filter((c) => c.status === "unsupported").length;
              const contraCount =
                result.accuracy?.contradicted_count ??
                result.claims.filter((c) => c.status === "contradicted" || c.status === "incorrect").length;
              const isExpanded = !!expandedAgents.accuracy;

              return (
                <div className="rounded-3xl border border-[#ece5f4] bg-white shadow-xs overflow-hidden transition hover:border-[#6d28d9]/40">
                  <button
                    type="button"
                    onClick={() => toggleAgent("accuracy")}
                    className="flex w-full items-center justify-between p-5 text-left bg-[#fdfcfe] hover:bg-[#faf8fd] transition border-b border-[#f1ecf7]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="grid size-10 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <FileCheck2 size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-bold text-[#17151c]">
                            2. Accuracy Agent
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                              accScore >= 80
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : accScore >= 50
                                ? "border-amber-200 bg-amber-50 text-amber-800"
                                : "border-rose-200 bg-rose-50 text-rose-800"
                            }`}
                          >
                            {accStatus}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[#787184] line-clamp-1">
                          Validates sentence-level claims and distinguishes supported vs unsupported statements.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 ml-3">
                      <div className="text-right">
                        <div className="font-display text-xl font-bold text-[#16a34a]">
                          {accScore} <span className="text-xs text-[#9b93a8]">/ 100</span>
                        </div>
                        <span className="text-[10px] font-semibold text-[#81798e]">Accuracy Score</span>
                      </div>
                      <div className="grid size-8 place-items-center rounded-full border border-[#ded5ea] bg-white text-[#655d71]">
                        {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-6 space-y-5 bg-white text-xs">
                      {/* Score progress bar */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-[#4a4255]">Accuracy Score</span>
                            <span className="text-sm font-bold text-[#16a34a]">{accScore}/100</span>
                          </div>
                          <ScoreBar score={accScore} color="#16a34a" />
                        </div>
                      </div>

                      {/* Student-friendly summary */}
                      <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1.5">
                          📖 In Simple Terms
                        </span>
                        <p className="text-xs leading-relaxed text-blue-900 font-medium">
                          {getAccuracySummary(accScore, suppCount, partCount, unsuppCount, contraCount)}
                        </p>
                      </div>

                      {/* Why this score? */}
                      <div className="rounded-2xl border border-[#ede7f5] bg-[#faf8fd] p-4">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#6d28d9] mb-1.5">
                          🔬 DETAILED REASONING
                        </span>
                        <p className="text-xs leading-relaxed text-[#231d2c] font-medium">
                          {accReasoning}
                        </p>
                      </div>

                      {/* Claims Breakdown Cards */}
                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[#736c7f] mb-2.5">
                          Claims Evaluated Breakdown ({result.claims.length} total)
                        </span>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-center">
                            <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                              Supported
                            </span>
                            <div className="mt-1 font-display text-xl font-bold text-emerald-700">
                              {suppCount}
                            </div>
                            <span className="text-[10px] text-emerald-800/80">Corroborated claims</span>
                          </div>

                          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5 text-center">
                            <span className="text-[10px] font-bold uppercase text-amber-800 block">
                              Partially Supported
                            </span>
                            <div className="mt-1 font-display text-xl font-bold text-amber-700">
                              {partCount}
                            </div>
                            <span className="text-[10px] text-amber-800/80">Minor discrepancy</span>
                          </div>

                          <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5 text-center">
                            <span className="text-[10px] font-bold uppercase text-rose-800 block">
                              Unsupported
                            </span>
                            <div className="mt-1 font-display text-xl font-bold text-rose-700">
                              {unsuppCount}
                            </div>
                            <span className="text-[10px] text-rose-800/80">Missing evidence</span>
                          </div>

                          <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-3.5 text-center">
                            <span className="text-[10px] font-bold uppercase text-purple-800 block">
                              Contradicted
                            </span>
                            <div className="mt-1 font-display text-xl font-bold text-purple-700">
                              {contraCount}
                            </div>
                            <span className="text-[10px] text-purple-800/80">Direct factual clash</span>
                          </div>
                        </div>

                        <div className="mt-3 text-[11px] text-[#6e677c] bg-[#fbfafc] border border-[#eee8f6] rounded-xl p-3 flex items-center justify-between">
                          <span>
                            <strong>Reference evidence used:</strong>{" "}
                            {result.referenceAnswer
                              ? "Canonical Reference Answer + PostgreSQL pgvector Knowledge Chunks"
                              : "Retrieved PostgreSQL pgvector Knowledge Chunks"}
                          </span>
                          <span className="font-semibold text-[#6d28d9]">
                            {result.evidence?.length || 0} grounding chunks
                          </span>
                        </div>

                        {/* Per-claim reasoning breakdown */}
                        {(result.accuracy?.claims || []).length > 0 && (
                          <div className="mt-4">
                            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#736c7f] mb-2">
                              Individual Claim Verification Details
                            </span>
                            <div className="space-y-2">
                              {(result.accuracy?.claims || []).map((ac, acIdx) => (
                                <div
                                  key={acIdx}
                                  className={`rounded-xl border p-3 ${
                                    ac.status === "SUPPORTED"
                                      ? "border-emerald-200 bg-emerald-50/30"
                                      : ac.status === "PARTIAL"
                                      ? "border-amber-200 bg-amber-50/30"
                                      : ac.status === "CONTRADICTED" || ac.status === "INCORRECT"
                                      ? "border-purple-200 bg-purple-50/30"
                                      : "border-rose-200 bg-rose-50/30"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-[11px] font-semibold text-[#1a1523] leading-snug flex-1">
                                      "{ac.claim}"
                                    </p>
                                    <span
                                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        ac.status === "SUPPORTED"
                                          ? "bg-emerald-100 text-emerald-800"
                                          : ac.status === "PARTIAL"
                                          ? "bg-amber-100 text-amber-800"
                                          : ac.status === "CONTRADICTED" || ac.status === "INCORRECT"
                                          ? "bg-purple-100 text-purple-800"
                                          : "bg-rose-100 text-rose-800"
                                      }`}
                                    >
                                      {ac.status}
                                    </span>
                                  </div>
                                  <div className="mt-2 rounded-lg border border-[#e6deef] bg-white p-2 text-[10px] text-[#4a4255]">
                                    <strong className="text-[#6d28d9]">Evidence:</strong> {ac.evidence || "No direct evidence found."}
                                  </div>
                                  <div className="mt-1 text-[10px] text-[#6e677c]">
                                    Similarity: <strong>{(ac.similarity * 100).toFixed(0)}%</strong>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── CARD 3: HALLUCINATION DETECTION AGENT ── */}
            {(() => {
              const halRisk = result.hallucination?.risk_score ?? result.scores.hallucinationRisk;
              const halStatus =
                result.hallucination?.status ||
                getHallucinationLevel(halRisk).label.toLowerCase();
              const halReasoning =
                result.hallucination?.reasoning ||
                (halRisk < 15
                  ? "Low hallucination risk. All factual assertions are corroborated by verified ground truth."
                  : halRisk < 40
                  ? "Moderate hallucination risk. Certain assertions lack grounding in the retrieved corpus."
                  : "High hallucination risk. The response contains assertions that could not be supported by evidence.");
              const flaggedClaims =
                result.hallucination?.flagged_claims && result.hallucination.flagged_claims.length > 0
                  ? result.hallucination.flagged_claims
                  : result.claims
                      .filter((c) => c.status !== "supported")
                      .map((c) => ({
                        claim: c.claim,
                        status: c.status.toUpperCase(),
                        reasoning:
                          c.note ||
                          "This statement could not be fully supported by the retrieved knowledge-base evidence.",
                        evidence: c.evidenceText || "No matching evidence excerpt found.",
                      }));
              const isExpanded = !!expandedAgents.hallucination;

              return (
                <div className="rounded-3xl border border-[#ece5f4] bg-white shadow-xs overflow-hidden transition hover:border-[#6d28d9]/40">
                  <button
                    type="button"
                    onClick={() => toggleAgent("hallucination")}
                    className="flex w-full items-center justify-between p-5 text-left bg-[#fdfcfe] hover:bg-[#faf8fd] transition border-b border-[#f1ecf7]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`grid size-10 place-items-center rounded-2xl ${
                          halRisk > 40 ? "bg-rose-100 text-rose-700" : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        <ShieldAlert size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-bold text-[#17151c]">
                            3. Hallucination Detection Agent
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                              getHallucinationLevel(halRisk).bg
                            } ${getHallucinationLevel(halRisk).color}`}
                          >
                            Risk: {halStatus}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[#787184] line-clamp-1">
                          Pinpoints ungrounded, fabricated, or contradictory claims against canonical evidence.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 ml-3">
                      <div className="text-right">
                        <div
                          className={`font-display text-xl font-bold ${
                            getHallucinationLevel(halRisk).color
                          }`}
                        >
                          {halRisk}% <span className="text-xs text-[#9b93a8]">Risk</span>
                        </div>
                        <span className="text-[10px] font-semibold text-[#81798e]">
                          {flaggedClaims.length} flagged claim{flaggedClaims.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid size-8 place-items-center rounded-full border border-[#ded5ea] bg-white text-[#655d71]">
                        {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-6 space-y-5 bg-white text-xs">
                      {/* Score progress bar (inverted - lower is better) */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-[#4a4255]">Hallucination Risk Level</span>
                            <span className={`text-sm font-bold ${getHallucinationLevel(halRisk).color}`}>{halRisk}%</span>
                          </div>
                          <ScoreBar score={halRisk} color={halRisk > 40 ? "#dc2626" : halRisk > 15 ? "#d97706" : "#16a34a"} />
                        </div>
                      </div>

                      {/* Student-friendly summary */}
                      <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1.5">
                          📖 In Simple Terms
                        </span>
                        <p className="text-xs leading-relaxed text-blue-900 font-medium">
                          {getHallucinationSummary(halRisk, flaggedClaims.length)}
                        </p>
                      </div>

                      {/* Why this score? */}
                      <div className="rounded-2xl border border-[#ede7f5] bg-[#faf8fd] p-4">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#6d28d9] mb-1.5">
                          🔬 DETAILED REASONING
                        </span>
                        <p className="text-xs leading-relaxed text-[#231d2c] font-medium">
                          {halReasoning}
                        </p>
                      </div>

                      {/* Flagged Claims Breakdown */}
                      <div>
                        <span className="block text-[11px] font-bold uppercase tracking-wider text-[#736c7f] mb-2.5">
                          Flagged Problematic Claims ({flaggedClaims.length})
                        </span>

                        {flaggedClaims.length === 0 ? (
                          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 text-emerald-900 flex items-center gap-2.5">
                            <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
                            <span>
                              <strong>No hallucinated claims detected:</strong> All statements in the AI response are corroborated by verified ground truth without unsupported or conflicting assertions.
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {flaggedClaims.map((item, idx) => (
                              <div
                                key={idx}
                                className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-4 space-y-2.5"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2">
                                    <span className="rounded-md bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-bold shrink-0 mt-0.5">
                                      Flagged Claim #{idx + 1}
                                    </span>
                                    <div className="text-xs font-semibold text-[#1a1523] leading-snug">
                                      "{item.claim}"
                                    </div>
                                  </div>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${
                                      item.status === "CONTRADICTED" || item.status === "HALLUCINATED"
                                        ? "bg-purple-100 text-purple-800 border border-purple-200"
                                        : "bg-rose-100 text-rose-800 border border-rose-200"
                                    }`}
                                  >
                                    {item.status}
                                  </span>
                                </div>

                                <div className="rounded-xl border border-[#eeddf0] bg-white p-3 text-[11px] text-[#423a4d] leading-relaxed">
                                  <strong className="text-rose-700 block mb-1">Why it was flagged:</strong>
                                  {item.reasoning}
                                </div>

                                {item.evidence && (
                                  <div className="rounded-xl border border-[#ece5f4] bg-[#fbfafc] p-2.5 text-[11px] font-mono text-[#4a4255]">
                                    <span className="text-[10px] font-bold uppercase text-[#888094] block not-font-mono mb-0.5">
                                      Available Evidence Reference:
                                    </span>
                                    {item.evidence}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {(() => {
              const compScore = result.completeness?.score ?? result.scores.completeness;
              const compStatus = result.completeness?.status;
              const compReasoning =
                result.completeness?.reasoning ||
                (compScore >= 80
                  ? `The response comprehensively covers ${compScore}% of the inquiry scope.`
                  : `The response partially covers ${compScore}% of the inquiry scope with some aspects omitted.`);
              const addressed = result.completeness?.addressed_aspects || [];
              const partial   = result.completeness?.partial_aspects   || [];
              const missing   = result.completeness?.missing_aspects   || [];
              const covered   = result.completeness?.covered_aspects   || [];
              // Legacy fallback
              const legacyCovered  = covered.length > 0 ? covered : [];
              const isExpanded = !!expandedAgents.completeness;

              const statusColor = compStatus === "complete"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : compStatus === "partial"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-rose-200 bg-rose-50 text-rose-800";
              const statusLabel = compStatus
                ? compStatus.charAt(0).toUpperCase() + compStatus.slice(1)
                : compScore >= 75 ? "Complete" : compScore >= 40 ? "Partial" : "Incomplete";

              return (
                <div className="rounded-3xl border border-[#ece5f4] bg-white shadow-xs overflow-hidden transition hover:border-[#6d28d9]/40">
                  <button
                    type="button"
                    onClick={() => toggleAgent("completeness")}
                    className="flex w-full items-center justify-between p-5 text-left bg-[#fdfcfe] hover:bg-[#faf8fd] transition border-b border-[#f1ecf7]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="grid size-10 place-items-center rounded-2xl bg-blue-100 text-blue-700">
                        <Zap size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-bold text-[#17151c]">
                            4. Completeness Agent
                          </span>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[#787184] line-clamp-1">
                          Analyzes inquiry coverage to ensure all essential sub-questions and facets are addressed.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 ml-3">
                      <div className="text-right">
                        <div className="font-display text-xl font-bold text-blue-600">
                          {compScore} <span className="text-xs text-[#9b93a8]">/ 100</span>
                        </div>
                        <span className="text-[10px] font-semibold text-[#81798e]">Completeness</span>
                      </div>
                      <div className="grid size-8 place-items-center rounded-full border border-[#ded5ea] bg-white text-[#655d71]">
                        {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                      </div>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-6 space-y-4 bg-white text-xs">
                      {/* Score progress bar */}
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-[#4a4255]">Completeness Score</span>
                            <span className="text-sm font-bold text-[#2563eb]">{compScore}/100</span>
                          </div>
                          <ScoreBar score={compScore} color="#2563eb" />
                        </div>
                      </div>

                      {/* Agent reasoning */}
                      <div className="rounded-2xl border border-[#ede7f5] bg-[#faf8fd] p-4">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-[#6d28d9] mb-1.5">
                          🔬 DETAILED REASONING
                        </span>
                        <p className="text-xs leading-relaxed text-[#231d2c] font-medium">
                          {compReasoning}
                        </p>
                      </div>

                      {/* M3.3 Three-bucket aspect breakdown */}
                      {(addressed.length > 0 || partial.length > 0 || missing.length > 0) ? (
                        <div className="space-y-3">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-[#736c7f]">
                            Aspect Coverage Breakdown
                          </span>

                          {addressed.length > 0 && (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-2">
                                ✅ Addressed Aspects ({addressed.length})
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {addressed.map((item, i) => (
                                  <span
                                    key={`addr-${i}`}
                                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"
                                  >
                                    <Check size={11} /> {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {partial.length > 0 && (
                            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2">
                                ⚡ Partially Covered Aspects ({partial.length})
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {partial.map((item, i) => (
                                  <span
                                    key={`part-${i}`}
                                    className="inline-flex items-center gap-1 rounded-lg bg-amber-100 border border-amber-200 px-2.5 py-1 text-[11px] font-semibold text-amber-800"
                                  >
                                    <AlertTriangle size={11} /> {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {missing.length > 0 && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-700 mb-2">
                                ❌ Missing Aspects ({missing.length})
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {missing.map((item, i) => (
                                  <span
                                    key={`miss-${i}`}
                                    className="inline-flex items-center gap-1 rounded-lg bg-rose-100 border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-800"
                                  >
                                    <XCircle size={11} /> {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : legacyCovered.length > 0 && (
                        /* Legacy covered/missing keyword display */
                        <div>
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-[#736c7f] mb-2">
                            Inquiry Aspect Coverage Breakdown
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {legacyCovered.map((item, i) => (
                              <span
                                key={`c-${i}`}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-800"
                              >
                                <Check size={12} /> Covered: {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {/* Section: Claim-by-Claim Analysis */}
          <section className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f0ebf7] pb-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#17151c]">
                  Claim Analysis ({result.claims.length} claim{result.claims.length !== 1 ? "s" : ""})
                </h3>
                <p className="text-xs text-[#756e81]">
                  Extracted atomic assertions verified individually against retrieved ground-truth chunks.
                </p>
              </div>

              {/* Status Filter buttons */}
              <div className="flex flex-wrap gap-1.5">
                {(["all", "supported", "partial", "unsupported", "contradicted"] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setClaimFilter(filterKey)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase transition ${
                      claimFilter === filterKey
                        ? "bg-[#6d28d9] text-white"
                        : "bg-[#faf8fd] text-[#635b70] border border-[#ede5f6] hover:bg-[#f2ecfa]"
                    }`}
                  >
                    {filterKey}
                  </button>
                ))}
              </div>
            </div>

            {/* Claims Accordion List */}
            <div className="mt-4 space-y-3">
              {filteredClaims.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#837b8f]">
                  No claims found matching status "{claimFilter}".
                </div>
              ) : (
                filteredClaims.map((claim, idx) => {
                  const isExpanded = expandedClaim === claim.id || expandedClaim === `clm-${idx}`;
                  const claimKey = claim.id || `clm-${idx}`;
                  return (
                    <div
                      key={claimKey}
                      className="rounded-2xl border border-[#ece5f4] bg-white overflow-hidden transition hover:border-[#6d28d9]/30"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedClaim(isExpanded ? null : claimKey)}
                        className="flex w-full items-center justify-between p-4 text-left hover:bg-[#fdfcfe] transition"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 rounded-md bg-[#f4effc] px-2 py-0.5 text-[10px] font-bold text-[#6d28d9]">
                            Claim {String(idx + 1).padStart(2, "0")}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-[#17151c] leading-snug">
                              "{claim.claim}"
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-[#787183]">
                              <span>Source: <strong className="text-[#3a3444]">{claim.source}</strong></span>
                              {claim.similarity !== undefined && (
                                <span>Similarity: <strong className="text-[#3a3444]">{(claim.similarity * 100).toFixed(0)}%</strong></span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          {getStatusBadge(claim.status)}
                          {isExpanded ? <ChevronDown size={16} className="text-[#7c7589]" /> : <ChevronRight size={16} className="text-[#7c7589]" />}
                        </div>
                      </button>

                      {/* Expanded Claim Details */}
                      {isExpanded && (
                        <div className="border-t border-[#f2edf7] bg-[#faf8fd] p-4 text-xs space-y-3">
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#847c92] mb-1">
                              Supporting Evidence Excerpt
                            </span>
                            <div className="rounded-xl border border-[#e6deef] bg-white p-3 font-mono text-[11px] leading-relaxed text-[#2c2637]">
                              {claim.evidenceText || "No direct evidence passage available in benchmark."}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[#6b6377]">
                            <div>
                              <strong>Evaluation Note:</strong> {claim.note || "Evaluated by AccuracyAgent against retrieved corpus."}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyEvidence(claim.evidenceText)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#dfd5ea] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6d28d9] hover:bg-[#f6f2fd]"
                            >
                              <Copy size={11} /> Copy Evidence
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Section: Retrieved Evidence Explorer */}
          <section className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#f0ebf7] pb-4">
              <div>
                <h3 className="font-display text-base font-bold text-[#17151c]">
                  Evidence Explorer ({result.evidence?.length || 0} Chunks Retrieved)
                </h3>
                <p className="text-xs text-[#756e81]">
                  Ground-truth excerpts retrieved from PostgreSQL pgvector index via cosine similarity.
                </p>
              </div>
            </div>

            {(!result.evidence || result.evidence.length === 0) ? (
              <div className="py-8 text-center text-xs text-[#837b8f]">
                No relevant evidence was found in the selected knowledge base.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {result.evidence.map((ev, idx) => (
                  <div
                    key={ev.chunk_id || idx}
                    className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-4 text-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 border-b border-[#eee8f6] pb-2">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="rounded-md bg-[#6d28d9]/10 px-2 py-0.5 text-[10px] font-bold text-[#6d28d9] uppercase">
                            {ev.dataset}
                          </span>
                          <span className="truncate font-semibold text-[#1e1927]">
                            {ev.source_name}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] font-bold text-[#16a34a]">
                          {(ev.score * 100).toFixed(1)}% match
                        </span>
                      </div>

                      <div className="mt-2.5 text-[11px] leading-relaxed text-[#352e42] line-clamp-4 font-mono bg-white rounded-xl border border-[#ece6f5] p-2.5">
                        {ev.content}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-end gap-2 border-t border-[#eee8f6] pt-2">
                      <button
                        type="button"
                        onClick={() => handleCopyEvidence(ev.content)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#ded5ea] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#5c546b] hover:border-[#6d28d9] hover:text-[#6d28d9]"
                      >
                        <Copy size={11} /> Copy Evidence
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyCitation(ev.source_name, ev.dataset, ev.chunk_id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#ded5ea] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#5c546b] hover:border-[#6d28d9] hover:text-[#6d28d9]"
                      >
                        <FileText size={11} /> Copy Citation
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section: Dedicated Hallucination Analysis */}
          <section className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm">
            <div className="border-b border-[#f0ebf7] pb-4">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert size={18} />
                <h3 className="font-display text-base font-bold text-[#17151c]">
                  Hallucination & Grounding Analysis
                </h3>
              </div>
              <p className="mt-1 text-xs text-[#756e81]">
                Differentiating between claims unsupported by available evidence versus verified factual contradictions.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-3 text-center">
                <div className="text-[10px] font-bold uppercase text-[#888194]">Total Claims</div>
                <div className="mt-1 font-display text-xl font-bold text-[#17151c]">
                  {result.claims.length}
                </div>
              </div>

              <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-3 text-center">
                <div className="text-[10px] font-bold uppercase text-[#888194]">Supported</div>
                <div className="mt-1 font-display text-xl font-bold text-[#16a34a]">
                  {result.claims.filter((c) => c.status === "supported").length}
                </div>
              </div>

              <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-3 text-center">
                <div className="text-[10px] font-bold uppercase text-[#888194]">Partial</div>
                <div className="mt-1 font-display text-xl font-bold text-amber-600">
                  {result.claims.filter((c) => c.status === "partial").length}
                </div>
              </div>

              <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-3 text-center">
                <div className="text-[10px] font-bold uppercase text-[#888194]">Unsupported</div>
                <div className="mt-1 font-display text-xl font-bold text-rose-600">
                  {result.claims.filter((c) => c.status === "unsupported").length}
                </div>
              </div>

              <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-3 text-center">
                <div className="text-[10px] font-bold uppercase text-[#888194]">Contradicted</div>
                <div className="mt-1 font-display text-xl font-bold text-purple-700">
                  {result.claims.filter((c) => c.status === "contradicted").length}
                </div>
              </div>
            </div>

            {/* Scientific Nuance Box */}
            <div className="mt-5 rounded-2xl border border-[#e8dfef] bg-[#faf7fd] p-4 text-xs text-[#584f65] leading-relaxed">
              <strong className="text-[#17151c] block mb-1">
                Factual Evidence Principle:
              </strong>
              VeriAI uses calibrated semantic distance thresholds. An "unsupported" claim indicates that the available benchmark corpus does not provide sufficient corroborating evidence; it does not necessarily denote deliberate deception. A "contradicted" claim represents a direct semantic clash against certified reference facts.
            </div>

            {/* Academic Follow-up & Next Steps Navigation */}
            <div className="mt-8 rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-[#17151c] flex items-center gap-2">
                    <Sparkles className="text-[#6d28d9]" size={16} /> Next Steps & Evaluation Actions
                  </h3>
                  <p className="text-xs text-[#797184] mt-0.5">
                    Save this artifact, review related runs in History, or initiate a new verification query.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleClear();
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#d9ceea] bg-[#faf8fd] px-3.5 py-2 text-xs font-semibold text-[#5421a7] hover:bg-[#ede5f7] transition"
                  >
                    <RotateCcw size={13} />
                    New Evaluation
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocation("/history")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#ece5f4] bg-white px-3.5 py-2 text-xs font-semibold text-[#484252] hover:bg-[#faf7fd] transition"
                  >
                    <Clock size={13} />
                    View History
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocation("/dashboard")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#ece5f4] bg-white px-3.5 py-2 text-xs font-semibold text-[#484252] hover:bg-[#faf7fd] transition"
                  >
                    Dashboard
                    <ArrowRight size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#6d28d9] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#5b21b6] transition"
                  >
                    <Download size={13} />
                    Export JSON
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppLayout>
  );
}

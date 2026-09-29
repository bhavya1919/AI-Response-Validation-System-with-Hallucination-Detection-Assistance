import { useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Gauge,
  Layers,
  Network,
  Play,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useEvaluation, PRESET_EVALUATIONS, type ClaimItem } from "@/contexts/EvaluationContext";

function ProductShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-[#fffefd] text-[#17151c]">
      <header className="sticky top-0 z-40 border-b border-[#eeeaf2] bg-white/90 backdrop-blur-xl">
        <div className="container flex h-[72px] items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2.5 transition hover:opacity-80"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-[#6d28d9] text-white shadow-[0_8px_20px_rgba(109,40,217,0.25)]">
              <ShieldCheck size={20} />
            </span>
            <span className="font-display text-[1.12rem] font-bold tracking-[-0.04em]">
              Veri<span className="text-[#6d28d9]">AI</span>
            </span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocation("/evaluate")}
              className="hidden sm:inline-flex rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#5a5364] hover:bg-[#f6f2fd] hover:text-[#6d28d9]"
            >
              Evaluate Studio
            </button>
            <button
              onClick={() => setLocation("/dashboard")}
              className="hidden sm:inline-flex rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#5a5364] hover:bg-[#f6f2fd] hover:text-[#6d28d9]"
            >
              Verdict Dashboard
            </button>
            <button
              onClick={() => setLocation("/architecture")}
              className="hidden sm:inline-flex rounded-full px-3.5 py-1.5 text-xs font-semibold text-[#5a5364] hover:bg-[#f6f2fd] hover:text-[#6d28d9]"
            >
              Architecture
            </button>
            <button
              onClick={() => setLocation("/")}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#d8cfe6] bg-white px-3.5 py-1.5 text-[12px] font-bold text-[#6d28d9] shadow-sm hover:bg-[#faf7fd]"
            >
              <ArrowLeft size={14} /> Back to Overview
            </button>
          </div>
        </div>
      </header>

      <main className="container py-12 sm:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#6d28d9]">
            <span className="h-px w-7 bg-[#6d28d9]/60" />
            {eyebrow}
          </div>
          <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.055em] sm:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#6d6874]">
            {description}
          </p>
          {children}
        </div>
      </main>
    </div>
  );
}

// =========================================================================
// 1. EVALUATE PAGE - Fully Interactive AI Response Evaluation Studio
// =========================================================================
export function EvaluatePage() {
  const [, setLocation] = useLocation();
  const {
    currentEvaluation,
    setCurrentEvaluation,
    isEvaluating,
    evaluationStep,
    evaluationStepText,
    runCustomEvaluation,
    selectPreset,
    selectedPresetKey,
  } = useEvaluation();

  const [question, setQuestion] = useState(currentEvaluation.question);
  const [reference, setReference] = useState(currentEvaluation.referenceAnswer);
  const [aiResponse, setAiResponse] = useState(currentEvaluation.aiResponse);
  const [activeBenchmark, setActiveBenchmark] = useState("squad_v2");
  const [hasEvaluated, setHasEvaluated] = useState(false);

  const handleApplyPreset = (key: string) => {
    selectPreset(key);
    const preset = PRESET_EVALUATIONS[key];
    if (preset) {
      setQuestion(preset.question);
      setReference(preset.referenceAnswer);
      setAiResponse(preset.aiResponse);
      setHasEvaluated(false);
    }
  };

  const handleRunEvaluation = async () => {
    if (!question.trim()) {
      toast.error("Please enter a question to evaluate");
      return;
    }
    if (!aiResponse.trim()) {
      toast.error("Please enter the AI-generated response");
      return;
    }

    try {
      await runCustomEvaluation({
        question,
        aiResponse,
        referenceAnswer: reference,
      });
      setHasEvaluated(true);
      toast.success("Evaluation pipeline completed successfully!");
    } catch (err) {
      toast.error("Evaluation failed: " + String(err));
    }
  };

  const handleReset = () => {
    setQuestion("");
    setReference("");
    setAiResponse("");
    setHasEvaluated(false);
    toast.info("Form cleared. Ready for custom evaluation.");
  };

  return (
    <ProductShell
      eyebrow="Evaluation Studio"
      title="Evaluate a response with context."
      description="Submit a question, AI-generated response, and optional ground truth. VeriAI executes RAG vector retrieval, factual claim extraction, and 4-agent jury evaluation."
    >
      {/* Preset Pickers */}
      <div className="mt-10 rounded-2xl border border-[#e5def2] bg-[#fcfbfe] p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#7e7688]">
            Quick Test Presets
          </span>
          <span className="text-[10px] text-[#9a91a4]">Click to pre-fill realistic scenarios</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "photosynthesis", label: "🌱 Photosynthesis (Pass · 91%)" },
            { id: "penicillin", label: "💊 Penicillin Nobel (Review · 68%)" },
            { id: "finance", label: "📉 Fed Rate Decision (Fail · 38%)" },
          ].map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                selectedPresetKey === preset.id && !hasEvaluated
                  ? "border-[#6d28d9] bg-[#6d28d9] text-white shadow-sm"
                  : "border-[#dfd7ec] bg-white text-[#4f4859] hover:border-[#bda9dd] hover:bg-[#faf7fd]"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#cfc3e3] bg-white px-3 py-1.5 text-xs font-semibold text-[#6d28d9] hover:bg-[#f4effc]"
          >
            <RotateCcw size={12} /> Clear Fields
          </button>
        </div>
      </div>

      {/* Main Interactive Form */}
      <div className="mt-6 rounded-3xl border border-[#e6e0ee] bg-white p-5 shadow-[0_18px_40px_rgba(44,25,69,0.07)] sm:p-7">
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-[#8e8797] mb-2">
              Question or Prompt
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. What causes solar eclipses?"
              className="w-full rounded-xl border border-[#e6e0ee] bg-[#fbfafc] p-3 text-xs leading-5 text-[#2f2938] outline-none transition focus:border-[#6d28d9] focus:bg-white focus:ring-2 focus:ring-[#6d28d9]/10"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-[#8e8797] mb-2">
              Reference Ground Truth (Optional)
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Canonical ground truth answer from dataset or trusted corpus"
              className="w-full rounded-xl border border-[#e6e0ee] bg-[#fbfafc] p-3 text-xs leading-5 text-[#2f2938] outline-none transition focus:border-[#6d28d9] focus:bg-white focus:ring-2 focus:ring-[#6d28d9]/10"
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-[#8e8797] mb-2">
            AI-Generated Response to Evaluate
          </label>
          <textarea
            rows={4}
            value={aiResponse}
            onChange={(e) => setAiResponse(e.target.value)}
            placeholder="Paste raw LLM response here..."
            className="w-full rounded-xl border border-[#e6e0ee] bg-[#fbfafc] p-3.5 text-xs leading-relaxed text-[#2f2938] outline-none transition focus:border-[#6d28d9] focus:bg-white focus:ring-2 focus:ring-[#6d28d9]/10"
          />
        </div>

        {/* Grounding Source Picker */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#eee8f6] bg-[#faf8fd] p-3 text-xs">
          <div className="flex items-center gap-2 text-[#564e60]">
            <Database size={15} className="text-[#6d28d9]" />
            <span className="font-semibold">Knowledge Base Vector Store:</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { id: "squad_v2", label: "Stanford SQuAD 2.0" },
              { id: "truthful_qa", label: "TruthfulQA Core" },
              { id: "custom_org", label: "Org Vector Docs" },
            ].map((bm) => (
              <button
                key={bm.id}
                onClick={() => {
                  setActiveBenchmark(bm.id);
                  toast.info(`Retriever switched to ${bm.label}`);
                }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                  activeBenchmark === bm.id
                    ? "bg-[#6d28d9] text-white"
                    : "bg-white text-[#6b6475] border border-[#e5dfef] hover:bg-[#f3eefb]"
                }`}
              >
                {bm.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Evaluation Progress Stepper */}
        {isEvaluating && (
          <div className="mt-5 rounded-2xl border border-[#cfc0e8] bg-[#f6f1fd] p-5 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-lg bg-[#6d28d9] text-white">
                  <Zap size={15} className="animate-spin" />
                </span>
                <span className="font-display text-xs font-bold text-[#2a2233]">
                  Running VeriAI Agent Jury...
                </span>
              </div>
              <span className="text-[11px] font-bold text-[#6d28d9]">
                Step {evaluationStep} of 4
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-[#655c73]">{evaluationStepText}</p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#e3d8f4]">
              <div
                className="h-full bg-[#6d28d9] transition-all duration-500"
                style={{ width: `${(evaluationStep / 4) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Execution Bar */}
        <div className="mt-6 flex flex-col justify-between gap-4 border-t border-[#eee8f4] pt-5 sm:flex-row sm:items-center">
          <div>
            <div className="font-display text-[14px] font-semibold tracking-[-0.04em] text-[#2e2736]">
              Ready for Multi-Agent Inspection
            </div>
            <div className="mt-0.5 text-[11px] text-[#81798b]">
              Vector retrieval, factual claim extraction, and judge agent execution.
            </div>
          </div>

          <button
            disabled={isEvaluating}
            onClick={handleRunEvaluation}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#6d28d9] px-6 py-3.5 text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(109,40,217,0.25)] transition-all hover:bg-[#5b21b6] active:scale-[0.98] disabled:opacity-50"
          >
            {isEvaluating ? (
              <>Evaluating...</>
            ) : (
              <>
                Run Evaluation <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Immediate Result Card */}
      {hasEvaluated && (
        <div className="mt-8 rounded-3xl border border-[#d2c5e8] bg-[#faf8fd] p-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e9e1f4] pb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#796f86]">
                Evaluation Completed
              </span>
              <h3 className="font-display text-2xl font-bold text-[#1b1723] mt-1">
                Verdict: {currentEvaluation.verdict} ({currentEvaluation.overallScore}/100)
              </h3>
            </div>
            <button
              onClick={() => setLocation("/dashboard")}
              className="inline-flex items-center gap-2 rounded-full bg-[#6d28d9] px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-[#5b21b6]"
            >
              Open in Full Dashboard <ArrowRight size={14} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Relevance", val: `${currentEvaluation.scores.relevance}%`, color: "text-[#6d28d9]" },
              { label: "Accuracy", val: `${currentEvaluation.scores.accuracy}%`, color: "text-[#16a34a]" },
              { label: "Hallucination Risk", val: `${currentEvaluation.scores.hallucinationRisk}%`, color: currentEvaluation.scores.hallucinationRisk > 20 ? "text-amber-600" : "text-[#16a34a]" },
              { label: "Completeness", val: `${currentEvaluation.scores.completeness}%`, color: "text-blue-600" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-[#e6deef] bg-white p-3 text-center">
                <div className="text-[10px] uppercase font-bold text-[#867f90]">{stat.label}</div>
                <div className={`mt-1 font-display text-xl font-bold ${stat.color}`}>{stat.val}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature Tags & Links */}
      <div className="mt-7 flex flex-wrap gap-2">
        <Tag icon={Search} label="Evidence retrieval via pgvector" />
        <Tag icon={Gauge} label="4 evaluation dimensions" />
        <Tag icon={FileCheck2} label="Explainable audit trail" />
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-[#eee9f4] pt-6">
        <button
          onClick={() => setLocation("/dashboard")}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6d28d9] hover:underline"
        >
          View sample dashboard <ArrowRight size={14} />
        </button>
        <button
          onClick={() => setLocation("/architecture")}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6d28d9] hover:underline"
        >
          Explore system architecture <ArrowRight size={14} />
        </button>
      </div>
    </ProductShell>
  );
}

// =========================================================================
// 2. DASHBOARD PAGE - Interactive Results, Claim Filtering, & Exports
// =========================================================================
export function DashboardPage() {
  const [, setLocation] = useLocation();
  const { currentEvaluation, selectPreset, selectedPresetKey } = useEvaluation();
  const [claimFilter, setClaimFilter] = useState<"all" | "supported" | "partial" | "unsupported">("all");
  const [expandedClaim, setExpandedClaim] = useState<string | null>(null);

  const filteredClaims = currentEvaluation.claims.filter((c) => {
    if (claimFilter === "all") return true;
    return c.status === claimFilter;
  });

  const handleExportJSON = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(currentEvaluation, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `veriai-verdict-${currentEvaluation.id}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    toast.success("Downloaded structured evaluation verdict as JSON");
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Shareable dashboard link copied to clipboard!");
  };

  const handlePrintPDF = () => {
    window.print();
    toast.info("Preparing print / PDF export dialog");
  };

  return (
    <ProductShell
      eyebrow="Evaluation Dashboard"
      title="Make the verdict legible."
      description="Inspect multi-agent evaluation signals, claim-level evidence alignments, hallucination risks, and download audit-ready compliance reports."
    >
      {/* Top Action Bar & Scenario Picker */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#e6dfee] bg-[#fbf9fc] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#797184]">
            Select Run:
          </span>
          {[
            { key: "photosynthesis", label: "🌱 Run #1 (Pass · 91%)" },
            { key: "penicillin", label: "💊 Run #2 (Review · 68%)" },
            { key: "finance", label: "📉 Run #3 (Fail · 38%)" },
          ].map((preset) => (
            <button
              key={preset.key}
              onClick={() => selectPreset(preset.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                selectedPresetKey === preset.key
                  ? "bg-[#6d28d9] text-white shadow-sm"
                  : "border border-[#ded6eb] bg-white text-[#554d60] hover:bg-[#f5effe]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyShareLink}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#d8cfe6] bg-white px-3 py-1.5 text-xs font-semibold text-[#544c5f] hover:bg-[#faf7fd] hover:text-[#6d28d9]"
          >
            <Share2 size={13} /> Share
          </button>
          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#d8cfe6] bg-white px-3 py-1.5 text-xs font-semibold text-[#544c5f] hover:bg-[#faf7fd] hover:text-[#6d28d9]"
          >
            <Download size={13} /> JSON
          </button>
          <button
            onClick={handlePrintPDF}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#6d28d9] px-3.5 py-1.5 text-xs font-bold text-white shadow hover:bg-[#5b21b6]"
          >
            <FileText size={13} /> Export PDF
          </button>
        </div>
      </div>

      {/* Dark Theme Verdict Card */}
      <div className="mt-6 overflow-hidden rounded-3xl bg-[#18131f] p-5 text-white shadow-[0_24px_55px_rgba(33,22,47,0.16)] sm:p-8">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end border-b border-white/10 pb-6">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200/60">
              Overall Verdict · {currentEvaluation.title}
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="font-display text-6xl font-semibold leading-none tracking-[-0.08em]">
                {currentEvaluation.overallScore}
              </span>
              <span className="mb-1.5 text-sm text-violet-100/50">/ 100</span>
            </div>
            <span
              className={`mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold ${
                currentEvaluation.verdict === "PASS"
                  ? "bg-[#1f8a48]/20 text-[#a7f3b7]"
                  : currentEvaluation.verdict === "REVIEW"
                  ? "bg-[#d97706]/20 text-[#f6c36a]"
                  : "bg-red-500/20 text-red-300"
              }`}
            >
              {currentEvaluation.verdict === "PASS" ? (
                <CheckCircle2 size={14} />
              ) : currentEvaluation.verdict === "REVIEW" ? (
                <Clock size={14} />
              ) : (
                <AlertTriangle size={14} />
              )}
              {currentEvaluation.verdict} · {currentEvaluation.confidence} confidence
            </span>
          </div>
          <Sparkles size={26} className="text-violet-300" />
        </div>

        {/* 4 Dimension Cards */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {[
            {
              label: "Relevance",
              value: `${currentEvaluation.scores.relevance}/100`,
              icon: Gauge,
              desc: "Query semantic alignment",
            },
            {
              label: "Accuracy",
              value: `${currentEvaluation.scores.accuracy}/100`,
              icon: BadgeCheck,
              desc: "Grounded in reference context",
            },
            {
              label: "Hallucination Risk",
              value: `${currentEvaluation.scores.hallucinationRisk}%`,
              icon: ShieldCheck,
              desc: "Unsupported factual claims",
            },
            {
              label: "Completeness",
              value: `${currentEvaluation.scores.completeness}/100`,
              icon: BarChart3,
              desc: "Coverage of question criteria",
            },
          ].map((dim) => (
            <div
              key={dim.label}
              className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.07]"
            >
              <div className="flex items-center justify-between text-[11px] text-violet-100/55">
                <span>{dim.label}</span>
                <dim.icon size={15} className="text-violet-300" />
              </div>
              <div className="mt-2 font-display text-3xl font-semibold tracking-[-0.07em]">
                {dim.value}
              </div>
              <div className="mt-1 text-[10px] text-violet-200/50">{dim.desc}</div>
            </div>
          ))}
        </div>

        {/* Reasons behind verdict */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-100/55">
            Agent Reasoning Rationale
          </div>
          <div className="mt-4 grid gap-2.5 text-[12px] text-violet-50/80 sm:grid-cols-2">
            {currentEvaluation.reasons.map((r, i) => (
              <span key={i} className="flex items-start gap-2 leading-snug">
                {r.positive ? (
                  <CheckCircle2 size={15} className="text-[#8bf0a7] shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={15} className="text-[#f6c36a] shrink-0 mt-0.5" />
                )}
                <span>{r.text}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Claim-Level Evidence Deep Dive */}
      <div className="mt-8 rounded-3xl border border-[#e6e0ee] bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#eee8f4] pb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-[#1f1927]">
              Extracted Claim Analysis
            </h3>
            <p className="text-xs text-[#756e80]">
              Atomic assertions compared against pgvector reference passages.
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-semibold">
            {[
              { id: "all", label: `All (${currentEvaluation.claims.length})` },
              {
                id: "supported",
                label: `Supported (${
                  currentEvaluation.claims.filter((c) => c.status === "supported").length
                })`,
              },
              {
                id: "partial",
                label: `Partial (${
                  currentEvaluation.claims.filter((c) => c.status === "partial").length
                })`,
              },
              {
                id: "unsupported",
                label: `Unsupported (${
                  currentEvaluation.claims.filter((c) => c.status === "unsupported").length
                })`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setClaimFilter(tab.id as any)}
                className={`rounded-full px-2.5 py-1 transition ${
                  claimFilter === tab.id
                    ? "bg-[#6d28d9] text-white"
                    : "bg-[#f3eff8] text-[#6d6676] hover:bg-[#e8e2f1]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Claim Cards */}
        <div className="mt-4 space-y-3">
          {filteredClaims.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 transition ${
                expandedClaim === item.id
                  ? "border-[#6d28d9] bg-[#faf8fd]"
                  : "border-[#e9e3f1] bg-white hover:border-[#cfc1e8]"
              }`}
            >
              <div
                className="flex cursor-pointer items-start justify-between gap-3"
                onClick={() =>
                  setExpandedClaim(expandedClaim === item.id ? null : item.id)
                }
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      item.status === "supported"
                        ? "bg-[#eaf8ed] text-[#16803b]"
                        : item.status === "partial"
                        ? "bg-[#fff5e5] text-[#b45309]"
                        : "bg-red-50 text-red-600"
                    }`}
                  >
                    {item.status === "supported" ? "✓" : item.status === "partial" ? "!" : "✕"}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-[#292332] leading-snug">
                      {item.claim}
                    </div>
                    <div className="mt-1 text-[11px] text-[#7d7586]">{item.note}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      item.status === "supported"
                        ? "bg-[#eaf8ed] text-[#16803b]"
                        : item.status === "partial"
                        ? "bg-[#fff5e5] text-[#b45309]"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {item.status}
                  </span>
                  <ChevronRight
                    size={15}
                    className={`text-[#9f96aa] transition-transform ${
                      expandedClaim === item.id ? "rotate-90" : ""
                    }`}
                  />
                </div>
              </div>

              {/* Expanded Evidence View */}
              {expandedClaim === item.id && (
                <div className="mt-3.5 border-t border-[#eee8f4] pt-3 text-xs">
                  <div className="rounded-xl border border-[#ded5ea] bg-white p-3">
                    <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#867e90] mb-1">
                      <span>Corroborating Evidence Passage</span>
                      <span className="text-[#6d28d9]">Source: {item.source} ({item.relevance}% relevance)</span>
                    </div>
                    <p className="italic text-[#4e4757]">"{item.evidenceText}"</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#eee9f4] pt-6">
        <button
          onClick={() => setLocation("/evaluate")}
          className="inline-flex items-center gap-2 rounded-full bg-[#6d28d9] px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-[#5b21b6]"
        >
          Run Another Evaluation <ArrowRight size={14} />
        </button>
        <button
          onClick={() => setLocation("/architecture")}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6d28d9] hover:underline"
        >
          View System Architecture <ArrowRight size={14} />
        </button>
      </div>
    </ProductShell>
  );
}

// =========================================================================
// 3. ARCHITECTURE PAGE - Interactive Pipeline Inspector & API Preview
// =========================================================================
export function ArchitecturePage() {
  const [, setLocation] = useLocation();
  const [selectedNode, setSelectedNode] = useState("orchestrator");

  const nodesInfo: Record<
    string,
    {
      title: string;
      tech: string;
      description: string;
      spec: string;
      schema: string;
    }
  > = {
    input: {
      title: "VeriAI Evaluation Input",
      tech: "JSON Schema / Pydantic v2",
      description:
        "Ingests user prompt, candidate AI response, optional ground truth reference, and custom metadata.",
      spec: "Latency SLA: < 15ms | Input validation & token sanitization",
      schema: `{
  "question": "string",
  "ai_response": "string",
  "reference_answer": "string (optional)",
  "benchmark_id": "string"
}`,
    },
    fastapi: {
      title: "FastAPI Async Gateway",
      tech: "FastAPI + Uvicorn + Pydantic v2",
      description:
        "Provides REST API endpoints, rate limiting, authentication headers, and job queuing.",
      spec: "Throughput: 1,200 req/sec | Middleware: Prometheus & Sentry",
      schema: `POST /v1/evaluate
Authorization: Bearer <API_KEY>
X-Tenant-ID: veriai-prod`,
    },
    orchestrator: {
      title: "Evaluation Orchestrator",
      tech: "Async Python / LangGraph Agents",
      description:
        "Coordinates evidence retrieval in parallel with individual judge agents to minimize overall evaluation latency.",
      spec: "Concurrent agent dispatch | Fallback handling | Token budget limiter",
      schema: `class EvaluationWorkflow:
  retriever = RAGVectorRetriever()
  judges = [RelevanceJudge(), AccuracyJudge(), HallucinationJudge()]
  verdict = VerdictSynthesisAgent()`,
    },
    rag: {
      title: "RAG Evidence Retrieval",
      tech: "PostgreSQL + pgvector (HNSW index)",
      description:
        "Queries indexed documents (SQuAD, TruthfulQA, internal docs) using 1,536-dimensional embeddings with cosine similarity.",
      spec: "HNSW search m=16, ef_construction=64 | Avg lookup: 24ms",
      schema: `SELECT chunk_id, content, 1 - (embedding <=> $1) AS similarity
FROM knowledge_chunks
WHERE similarity > 0.78
ORDER BY similarity DESC LIMIT 5;`,
    },
    judges: {
      title: "Judge Agents Jury",
      tech: "Structured Chain-of-Thought Evaluators",
      description:
        "Four specialized evaluators: Relevance, Factual Accuracy, Hallucination Risk, and Completeness.",
      spec: "Multi-prompt temperature 0.1 | Strict JSON schema output",
      schema: `{
  "relevance_score": 96,
  "accuracy_score": 94,
  "unsupported_claims_count": 0,
  "completeness_score": 86
}`,
    },
    verdict: {
      title: "Verdict Synthesis Agent",
      tech: "Weighted Aggregation & Confidence Estimator",
      description:
        "Synthesizes judge signals into an overall 0-100 score, produces PASS/REVIEW/FAIL verdict, and writes human-legible rationale.",
      spec: "Deterministic weighted rulebook + human override flags",
      schema: `{
  "verdict": "PASS",
  "overall_score": 91,
  "confidence": "high",
  "audit_trail_id": "audit_82f019"
}`,
    },
    storage: {
      title: "Storage & Persistence",
      tech: "PostgreSQL 16 + pgvector",
      description:
        "Stores complete historical evaluations, chunk embeddings, user benchmark configs, and compliance audit logs.",
      spec: "ACID compliant | Row-level tenant security | Auto-partitioning",
      schema: `CREATE TABLE evaluation_runs (
  id UUID PRIMARY KEY,
  question TEXT NOT NULL,
  verdict VARCHAR(16) NOT NULL,
  score INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`,
    },
  };

  const active = nodesInfo[selectedNode] || nodesInfo.orchestrator;

  const handleCopySchema = () => {
    navigator.clipboard.writeText(active.schema);
    toast.success(`Copied ${active.title} schema to clipboard!`);
  };

  return (
    <ProductShell
      eyebrow="System Architecture"
      title="A modular path from input to evidence-backed verdict."
      description="Click any component in the interactive pipeline below to inspect its technical specification, API payloads, and execution behavior."
    >
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Interactive Diagram Pipeline */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#8a8393] mb-1">
            Click a component to inspect:
          </div>

          <ArchButton
            id="input"
            selected={selectedNode === "input"}
            onClick={() => setSelectedNode("input")}
            label="1. VeriAI Evaluation Input"
            detail="Question · AI Response · Optional references"
            icon={FileText}
          />
          <ArrowDown />
          <ArchButton
            id="fastapi"
            selected={selectedNode === "fastapi"}
            onClick={() => setSelectedNode("fastapi")}
            label="2. FastAPI Gateway Layer"
            detail="Pydantic validation, auth & async queuing"
            icon={Network}
          />
          <ArrowDown />
          <ArchButton
            id="orchestrator"
            selected={selectedNode === "orchestrator"}
            onClick={() => setSelectedNode("orchestrator")}
            label="3. Evaluation Orchestrator"
            detail="Coordinates parallel retrieval & judge agents"
            icon={Zap}
          />
          <ArrowDown />
          <div className="grid grid-cols-2 gap-2">
            <ArchButton
              id="rag"
              selected={selectedNode === "rag"}
              onClick={() => setSelectedNode("rag")}
              label="4a. RAG Retrieval"
              detail="pgvector cosine search"
              icon={Search}
            />
            <ArchButton
              id="judges"
              selected={selectedNode === "judges"}
              onClick={() => setSelectedNode("judges")}
              label="4b. Judge Agents"
              detail="4 dimensions of quality"
              icon={Layers}
            />
          </div>
          <ArrowDown />
          <ArchButton
            id="verdict"
            selected={selectedNode === "verdict"}
            onClick={() => setSelectedNode("verdict")}
            label="5. Verdict Agent"
            detail="Weighted score synthesis & decision"
            icon={BadgeCheck}
          />
          <ArrowDown />
          <ArchButton
            id="storage"
            selected={selectedNode === "storage"}
            onClick={() => setSelectedNode("storage")}
            label="6. PostgreSQL + pgvector Storage"
            detail="Structured audit records & vector indexes"
            icon={Database}
          />
        </div>

        {/* Live Inspector Panel */}
        <div className="rounded-3xl border border-[#ded5ea] bg-white p-5 shadow-lg lg:sticky lg:top-24 h-fit">
          <div className="flex items-center justify-between border-b border-[#eee8f4] pb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6d28d9]">
              Component Inspector
            </span>
            <span className="rounded-md bg-[#f1ebfa] px-2 py-0.5 text-[10px] font-bold text-[#6d28d9]">
              {active.tech}
            </span>
          </div>

          <h3 className="mt-3 font-display text-xl font-bold text-[#1b1723]">
            {active.title}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[#625b6e]">
            {active.description}
          </p>

          <div className="mt-4 rounded-xl border border-[#e8e2ef] bg-[#faf8fd] p-3 text-xs">
            <div className="text-[10px] uppercase font-bold text-[#867e91]">
              Performance & SLA
            </div>
            <div className="mt-1 font-semibold text-[#2b2535]">{active.spec}</div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-bold text-[#867e91]">
                Payload / Implementation
              </span>
              <button
                onClick={handleCopySchema}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6d28d9] hover:underline"
              >
                <Copy size={12} /> Copy
              </button>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-[#18131f] p-3.5 text-[11px] font-mono leading-relaxed text-violet-100">
              {active.schema}
            </pre>
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-[#eee9f4] pt-6">
        <button
          onClick={() => setLocation("/evaluate")}
          className="inline-flex items-center gap-2 rounded-full bg-[#6d28d9] px-5 py-3 text-xs font-bold text-white shadow hover:bg-[#5b21b6]"
        >
          Launch Evaluation Studio <ArrowRight size={14} />
        </button>
        <button
          onClick={() => setLocation("/dashboard")}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#6d28d9] hover:underline"
        >
          View Live Dashboard <ArrowRight size={14} />
        </button>
      </div>
    </ProductShell>
  );
}

function ArchButton({
  id,
  selected,
  onClick,
  label,
  detail,
  icon: Icon,
}: {
  id: string;
  selected: boolean;
  onClick: () => void;
  label: string;
  detail: string;
  icon: typeof FileText;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 transition ${
        selected
          ? "border-[#6d28d9] bg-[#f5efff] shadow-sm"
          : "border-[#e6dfef] bg-white hover:border-[#cfc1e8] hover:bg-[#fbf9fe]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`grid size-8 place-items-center rounded-xl ${
            selected ? "bg-[#6d28d9] text-white" : "bg-[#f2ecfc] text-[#6d28d9]"
          }`}
        >
          <Icon size={16} />
        </span>
        <div>
          <div className="font-display text-sm font-semibold text-[#282231]">
            {label}
          </div>
          <div className="text-[11px] text-[#7d7586]">{detail}</div>
        </div>
      </div>
    </button>
  );
}

function Tag({ icon: Icon, label }: { icon: typeof Search; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[#e6e0ee] bg-white px-3 py-2 text-[11px] font-semibold text-[#746c7e]">
      <Icon size={14} className="text-[#6d28d9]" />
      {label}
    </span>
  );
}

function ArrowDown() {
  return (
    <div className="grid place-items-center py-0.5 text-[#b9a5d6]">
      <ArrowRight size={15} className="rotate-90" />
    </div>
  );
}

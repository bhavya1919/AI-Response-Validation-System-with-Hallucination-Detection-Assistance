import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
  XCircle,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import {
  uploadBatchEvaluation,
  getBatchHistory,
  getBatchPDFUrl,
  type BatchUploadResponse,
  type BatchResultItem,
  type BatchRun,
} from "@/services/api";
import { toast } from "sonner";

export default function BatchEvaluate() {
  const [, setLocation] = useLocation();

  // Upload & config state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [referenceCol, setReferenceCol] = useState("");
  const [topK, setTopK] = useState(5);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Results state
  const [batchResponse, setBatchResponse] = useState<BatchUploadResponse | null>(null);
  const [selectedRowItem, setSelectedRowItem] = useState<BatchResultItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<"ALL" | "PASS" | "REVIEW" | "FAIL">("ALL");
  const [completenessFilter, setCompletenessFilter] = useState<"ALL" | "complete" | "partial" | "incomplete">("ALL");

  // History state
  const [historyRuns, setHistoryRuns] = useState<BatchRun[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  // Timer while processing
  useEffect(() => {
    if (isProcessing) {
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isProcessing]);

  // Load past batches on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await getBatchHistory(15);
      setHistoryRuns(res.batches || []);
    } catch {
      // Non-fatal if history cannot be loaded
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Drag-and-drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".csv")) {
        setSelectedFile(file);
      } else {
        toast.error("Please provide a .csv file.");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.toLowerCase().endsWith(".csv")) {
        setSelectedFile(file);
      } else {
        toast.error("Please provide a .csv file.");
      }
    }
  };

  // Trigger evaluation
  const handleUploadAndRun = async () => {
    if (!selectedFile) {
      toast.error("Select a CSV file first.");
      return;
    }

    setIsProcessing(true);
    setBatchResponse(null);
    setSelectedRowItem(null);

    try {
      const res = await uploadBatchEvaluation(selectedFile, {
        referenceColumn: referenceCol.trim() || undefined,
        topK: topK || 5,
      });
      setBatchResponse(res);
      toast.success(`Batch complete: ${res.valid_rows} evaluated, ${res.summary.pass} passed.`);
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || "Batch evaluation failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Sample CSV template download
  const handleDownloadSampleCSV = () => {
    const sampleCsv = `question,response,reference
What causes diabetes mellitus?,"Diabetes mellitus is primarily a chronic metabolic disorder marked by elevated blood glucose levels due to insulin deficiency, insulin resistance, or both. Type 1 is autoimmune, while Type 2 involves insulin resistance and progressive secretory defect.","Diabetes is characterized by hyperglycemia resulting from defects in insulin secretion, insulin action, or both."
How does photosynthesis work?,"Photosynthesis is the biochemical process by which green plants and cyanobacteria convert light energy into chemical energy in chloroplasts, producing glucose and releasing oxygen from water and CO2.","Photosynthesis converts light into chemical energy stored in carbohydrates, utilizing chlorophyll to absorb photons."
What are the symptoms of acute appendicitis?,"Acute appendicitis typically presents with periumbilical pain migrating to the right lower quadrant, fever, nausea, vomiting, and localized abdominal guarding.","Appendicitis presents with right lower quadrant pain, anorexia, nausea, fever, and leukocytosis."
What was the GDP of the United States in 1820?,"The GDP was exactly 95 trillion dollars and was managed exclusively by digital blockchain ledgers.","Historical estimates place US GDP around 12 billion dollars in 1820."
What is Einstein's mass-energy equivalence?,"Energy equals mass multiplied by the square of the speed of light (E=mc^2).","E=mc^2 states that mass and energy are interchangeable."
`;
    const blob = new Blob([sampleCsv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "veriai_sample_batch.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.info("Downloaded sample CSV template.");
  };

  // Export Results as CSV
  const handleExportResultsCSV = () => {
    if (!batchResponse || !batchResponse.results.length) return;

    const headers = [
      "Row",
      "Evaluation ID",
      "Question",
      "Verdict",
      "Overall Score",
      "Relevance",
      "Accuracy",
      "Hallucination Risk",
      "Completeness",
      "Completeness Status",
      "Status",
    ];

    const rows = batchResponse.results.map((r) => [
      r.row,
      r.id || "",
      `"${(r.question || "").replace(/"/g, '""')}"`,
      r.verdict || "N/A",
      r.overall_score ?? "",
      r.scores?.relevance ?? "",
      r.scores?.accuracy ?? "",
      r.scores?.hallucinationRisk ?? "",
      r.scores?.completeness ?? "",
      r.completeness_status || "",
      r.status,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `veriai_batch_${batchResponse.batch_id.slice(0, 8)}_results.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Exported batch results to CSV.");
  };

  // Export Summary as JSON
  const handleExportJSON = () => {
    if (!batchResponse) return;
    const blob = new Blob([JSON.stringify(batchResponse, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `veriai_batch_${batchResponse.batch_id.slice(0, 8)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Exported batch evaluation JSON.");
  };

  // Filtered rows
  const filteredResults = (batchResponse?.results || []).filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesQ = (item.question || "").toLowerCase().includes(q);
      const matchesId = (item.id || "").toLowerCase().includes(q);
      if (!matchesQ && !matchesId) return false;
    }
    if (verdictFilter !== "ALL") {
      if (item.verdict !== verdictFilter) return false;
    }
    if (completenessFilter !== "ALL") {
      if ((item.completeness_status || "").toLowerCase() !== completenessFilter) return false;
    }
    return true;
  });

  return (
    <AppLayout
      eyebrow="HIGH-THROUGHPUT EVALUATION"
      title="Batch Evaluation"
      subtitle="Upload CSV test sets to execute high-speed multi-agent evaluations across Relevance, Accuracy, Completeness, and Hallucination dimensions."
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadSampleCSV}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ded5ea] bg-white px-3.5 py-1.5 text-xs font-bold text-[#5e566d] hover:bg-[#f6f2fd] hover:text-[#6d28d9] transition-all"
          >
            <Download size={13} /> Sample CSV Template
          </button>
          <button
            onClick={() => setLocation("/evaluate")}
            className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3.5 py-1.5 text-xs font-bold text-[#6d28d9] hover:bg-purple-100 transition-all"
          >
            Single Evaluator <ArrowRight size={13} />
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Upload & Configuration Card */}
        <div className="rounded-3xl border border-[#ded5ea] bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-[#f1ebf7] pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-[#6d28d9]">
                <UploadCloud size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#1f192b]">Dataset Ingestion</h2>
                <p className="text-xs text-[#837b8f]">
                  Upload a CSV file containing questions and AI responses to evaluate
                </p>
              </div>
            </div>
            {selectedFile && (
              <button
                onClick={() => setSelectedFile(null)}
                className="text-xs text-[#837b8f] hover:text-rose-600 flex items-center gap-1"
              >
                <X size={13} /> Clear file
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Drag & Drop Box */}
            <div className="lg:col-span-2">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
                  dragActive
                    ? "border-[#6d28d9] bg-purple-50/60"
                    : selectedFile
                    ? "border-emerald-300 bg-emerald-50/30"
                    : "border-[#ded5ea] hover:border-purple-300 hover:bg-[#faf7fd]"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div className="font-semibold text-sm text-[#1f192b]">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-[#837b8f]">
                      {(selectedFile.size / 1024).toFixed(1)} KB • Ready for multi-agent evaluation
                    </div>
                    <span className="inline-block text-[11px] font-medium text-emerald-700 bg-emerald-100/70 px-2.5 py-0.5 rounded-full">
                      Click or drag to change file
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-[#6d28d9]">
                      <UploadCloud size={24} />
                    </div>
                    <div className="font-semibold text-sm text-[#1f192b]">
                      Drop your CSV dataset here, or <span className="text-[#6d28d9] underline">browse</span>
                    </div>
                    <p className="text-xs text-[#837b8f] max-w-sm">
                      Requires columns: <code className="bg-[#f2edfa] px-1 py-0.5 rounded text-[#6d28d9] font-mono">question</code> and <code className="bg-[#f2edfa] px-1 py-0.5 rounded text-[#6d28d9] font-mono">response</code>. Optional: <code className="bg-[#f2edfa] px-1 py-0.5 rounded text-[#6d28d9] font-mono">reference</code>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Ingestion Settings */}
            <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-[#ded5ea] bg-[#faf8fc] p-4">
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#837b8f]">
                  Pipeline Options
                </span>

                <div>
                  <label className="block text-xs font-medium text-[#463e52] mb-1">
                    Reference Answer Column (Optional)
                  </label>
                  <input
                    type="text"
                    value={referenceCol}
                    onChange={(e) => setReferenceCol(e.target.value)}
                    placeholder="Auto-detect (reference, ground_truth)"
                    className="w-full rounded-xl border border-[#ded5ea] bg-white px-3 py-2 text-xs text-[#1f192b] placeholder-[#a69eb2] focus:border-[#6d28d9] focus:outline-none"
                  />
                  <span className="text-[11px] text-[#837b8f] mt-0.5 block">
                    If omitted, auto-discovers ground truth or uses RAG evidence.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#463e52] mb-1">
                    RAG Knowledge Depth (top_k)
                  </label>
                  <select
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#ded5ea] bg-white px-3 py-2 text-xs text-[#1f192b] focus:border-[#6d28d9] focus:outline-none"
                  >
                    <option value={3}>3 Evidence Chunks (Faster)</option>
                    <option value={5}>5 Evidence Chunks (Balanced)</option>
                    <option value={8}>8 Evidence Chunks (Thorough)</option>
                  </select>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  onClick={handleUploadAndRun}
                  disabled={!selectedFile || isProcessing}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6d28d9] to-[#8b5cf6] py-2.5 px-4 text-xs font-bold text-white shadow-md hover:from-[#5b21b6] hover:to-[#7c3aed] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      Evaluating Batch... ({elapsedSeconds}s)
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      Run Batch Evaluation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Processing State Indicator */}
        {isProcessing && (
          <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-5 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6d28d9] text-white animate-pulse">
              <Layers size={20} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-[#1f192b]">
                Multi-Agent Pipeline in Progress
              </div>
              <p className="text-xs text-[#5e566d]">
                Retrieving knowledge evidence and executing Relevance, Accuracy, Completeness, and Hallucination Judges row-by-row...
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-sm font-bold text-[#6d28d9]">
                {elapsedSeconds}s elapsed
              </span>
            </div>
          </div>
        )}

        {/* Evaluation Summary KPIs */}
        {batchResponse && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1f192b]">
                  Batch Results Summary: <span className="font-mono text-[#6d28d9]">{batchResponse.batch_id.slice(0, 12)}...</span>
                </h3>
                <p className="text-xs text-[#837b8f]">
                  Evaluated {batchResponse.valid_rows} of {batchResponse.total_rows} items
                  {batchResponse.failed_rows > 0 && ` (${batchResponse.failed_rows} skipped or invalid)`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={getBatchPDFUrl(batchResponse.batch_id)}
                  download={`VeriAI_Batch_Report_${batchResponse.batch_id}.pdf`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#6d28d9] px-3.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#5b21b6] transition-all"
                >
                  <FileText size={13} /> Export PDF Report (M4.2)
                </a>
                <button
                  onClick={handleExportResultsCSV}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ded5ea] bg-white px-3 py-1 text-xs font-semibold text-[#5e566d] hover:bg-[#f6f2fd] hover:text-[#6d28d9] transition-all"
                >
                  <Download size={13} /> Export CSV
                </button>
                <button
                  onClick={handleExportJSON}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#ded5ea] bg-white px-3 py-1 text-xs font-semibold text-[#5e566d] hover:bg-[#f6f2fd] hover:text-[#6d28d9] transition-all"
                >
                  <Download size={13} /> Export JSON
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {/* Total Card */}
              <div className="rounded-2xl border border-[#ded5ea] bg-white p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#837b8f]">
                  Evaluated
                </span>
                <div className="mt-1 text-2xl font-extrabold text-[#1f192b]">
                  {batchResponse.valid_rows}
                </div>
                <div className="text-[11px] text-[#837b8f] mt-0.5">
                  of {batchResponse.total_rows} total rows
                </div>
              </div>

              {/* Pass Card */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    Passed
                  </span>
                  <ShieldCheck size={16} className="text-emerald-600" />
                </div>
                <div className="mt-1 text-2xl font-extrabold text-emerald-700">
                  {batchResponse.summary.pass}
                </div>
                <div className="text-[11px] text-emerald-800 mt-0.5">
                  {batchResponse.valid_rows > 0
                    ? `${Math.round((batchResponse.summary.pass / batchResponse.valid_rows) * 100)}% pass rate`
                    : "0%"}
                </div>
              </div>

              {/* Review Card */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                    Review
                  </span>
                  <AlertTriangle size={16} className="text-amber-600" />
                </div>
                <div className="mt-1 text-2xl font-extrabold text-amber-700">
                  {batchResponse.summary.needs_improvement}
                </div>
                <div className="text-[11px] text-amber-800 mt-0.5">Needs check</div>
              </div>

              {/* Fail Card */}
              <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">
                    Failed
                  </span>
                  <XCircle size={16} className="text-rose-600" />
                </div>
                <div className="mt-1 text-2xl font-extrabold text-rose-700">
                  {batchResponse.summary.fail}
                </div>
                <div className="text-[11px] text-rose-800 mt-0.5">Critical defects</div>
              </div>

              {/* Avg Score */}
              <div className="rounded-2xl border border-purple-200 bg-purple-50/40 p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6d28d9]">
                  Avg Score
                </span>
                <div className="mt-1 text-2xl font-extrabold text-[#6d28d9]">
                  {batchResponse.summary.avg_score}
                  <span className="text-xs font-normal text-[#837b8f]">/100</span>
                </div>
                <div className="text-[11px] text-[#837b8f] mt-0.5">Calibrated M3.2</div>
              </div>

              {/* Avg Completeness */}
              <div className="rounded-2xl border border-[#ded5ea] bg-white p-4 shadow-sm">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#837b8f]">
                  Completeness
                </span>
                <div className="mt-1 text-2xl font-extrabold text-[#463e52]">
                  {batchResponse.summary.avg_completeness}
                  <span className="text-xs font-normal text-[#837b8f]">/100</span>
                </div>
                <div className="text-[11px] text-[#837b8f] mt-0.5">M3.1 Judge Agent</div>
              </div>
            </div>

            {/* Agent Metric Breakdown Pill Bar */}
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#ded5ea] bg-[#faf8fc] px-4 py-2.5 text-xs text-[#5e566d]">
              <span className="font-bold text-[#1f192b]">Dimension Averages:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#837b8f]">Relevance:</span>
                <span className="font-bold text-[#6d28d9]">{batchResponse.summary.avg_relevance}/100</span>
              </div>
              <span className="text-[#ded5ea]">•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#837b8f]">Accuracy:</span>
                <span className="font-bold text-emerald-700">{batchResponse.summary.avg_accuracy}/100</span>
              </div>
              <span className="text-[#ded5ea]">•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#837b8f]">Completeness:</span>
                <span className="font-bold text-blue-700">{batchResponse.summary.avg_completeness}/100</span>
              </div>
              <span className="text-[#ded5ea]">•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#837b8f]">Hallucination Risk:</span>
                <span className="font-bold text-rose-600">{batchResponse.summary.avg_hallucination_risk}/100</span>
              </div>
            </div>

            {/* Invalid rows warning banner if any */}
            {batchResponse.failed_details && batchResponse.failed_details.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <AlertTriangle size={15} />
                  {batchResponse.failed_details.length} row(s) could not be evaluated
                </div>
                <ul className="mt-1 list-disc list-inside text-xs text-amber-800 space-y-0.5">
                  {batchResponse.failed_details.slice(0, 5).map((f, i) => (
                    <li key={i}>
                      Row {f.row}: {f.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a69eb2]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by question text or record ID..."
                  className="w-full rounded-full border border-[#ded5ea] bg-white pl-9 pr-4 py-2 text-xs text-[#1f192b] placeholder-[#a69eb2] focus:border-[#6d28d9] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Verdict filter */}
                <div className="flex items-center rounded-full border border-[#ded5ea] bg-white p-0.5 text-xs">
                  {(["ALL", "PASS", "REVIEW", "FAIL"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVerdictFilter(v)}
                      className={`px-2.5 py-1 rounded-full font-semibold transition-all ${
                        verdictFilter === v
                          ? "bg-[#6d28d9] text-white"
                          : "text-[#5e566d] hover:text-[#1f192b]"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>

                {/* Completeness filter */}
                <div className="flex items-center rounded-full border border-[#ded5ea] bg-white p-0.5 text-xs">
                  {(["ALL", "complete", "partial", "incomplete"] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCompletenessFilter(c)}
                      className={`px-2.5 py-1 rounded-full font-semibold capitalize transition-all ${
                        completenessFilter === c
                          ? "bg-purple-100 text-[#6d28d9]"
                          : "text-[#5e566d] hover:text-[#1f192b]"
                      }`}
                    >
                      {c === "ALL" ? "All Comp." : c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-hidden rounded-2xl border border-[#ded5ea] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#f1ebf7] bg-[#faf8fc] text-[11px] font-bold uppercase tracking-wider text-[#837b8f]">
                      <th className="py-3 px-4 w-12">#</th>
                      <th className="py-3 px-4">Question</th>
                      <th className="py-3 px-4 text-center">Verdict</th>
                      <th className="py-3 px-4 text-center">Score</th>
                      <th className="py-3 px-4 text-center">Rel.</th>
                      <th className="py-3 px-4 text-center">Acc.</th>
                      <th className="py-3 px-4 text-center">Halluc.</th>
                      <th className="py-3 px-4 text-center">Completeness</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1ebf7]">
                    {filteredResults.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-xs text-[#837b8f]">
                          No evaluated items match the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredResults.map((item) => {
                        const vColor =
                          item.verdict === "PASS"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : item.verdict === "REVIEW"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200";

                        const compColor =
                          item.completeness_status === "complete"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : item.completeness_status === "partial"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-rose-50 text-rose-700 border-rose-200";

                        return (
                          <tr
                            key={item.row}
                            className="hover:bg-[#faf7fd] transition-colors cursor-pointer"
                            onClick={() => setSelectedRowItem(item)}
                          >
                            <td className="py-3 px-4 font-mono text-[#837b8f]">
                              {item.row}
                            </td>
                            <td className="py-3 px-4 font-medium text-[#1f192b] max-w-xs truncate">
                              {item.question || "N/A"}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {item.verdict ? (
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${vColor}`}
                                >
                                  {item.verdict === "PASS" && <CheckCircle2 size={11} />}
                                  {item.verdict === "REVIEW" && <AlertTriangle size={11} />}
                                  {item.verdict === "FAIL" && <XCircle size={11} />}
                                  {item.verdict}
                                </span>
                              ) : (
                                <span className="text-[#a69eb2]">—</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-[#1f192b]">
                              {item.overall_score !== undefined ? `${item.overall_score}` : "—"}
                            </td>
                            <td className="py-3 px-4 text-center text-[#5e566d]">
                              {item.scores?.relevance ?? "—"}
                            </td>
                            <td className="py-3 px-4 text-center text-[#5e566d]">
                              {item.scores?.accuracy ?? "—"}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {item.scores?.hallucinationRisk !== undefined ? (
                                <span
                                  className={
                                    item.scores.hallucinationRisk >= 50
                                      ? "font-bold text-rose-600"
                                      : "text-[#5e566d]"
                                  }
                                >
                                  {item.scores.hallucinationRisk}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {item.completeness_status ? (
                                <span
                                  className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${compColor}`}
                                >
                                  {item.completeness_status} ({item.scores?.completeness ?? 0})
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRowItem(item);
                                }}
                                className="inline-flex items-center gap-1 rounded-lg border border-[#ded5ea] bg-white px-2 py-1 text-[11px] font-medium text-[#5e566d] hover:text-[#6d28d9] hover:bg-[#f6f2fd] transition-all"
                              >
                                <Eye size={12} /> Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Row Inspector Drawer / Modal */}
        {selectedRowItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-xl rounded-3xl border border-[#ded5ea] bg-white p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-[#f1ebf7] pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 text-[#6d28d9]">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#1f192b]">
                      Row #{selectedRowItem.row} Evaluation Breakdown
                    </h3>
                    <span className="font-mono text-[11px] text-[#837b8f]">
                      ID: {selectedRowItem.id || "N/A"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRowItem(null)}
                  className="rounded-full p-1 text-[#837b8f] hover:bg-slate-100 hover:text-[#1f192b]"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Question */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#837b8f]">
                  Question
                </span>
                <p className="mt-1 rounded-xl bg-[#faf8fc] p-3 text-xs text-[#1f192b] font-medium border border-[#ded5ea]">
                  {selectedRowItem.question}
                </p>
              </div>

              {/* Verdict & Scores Grid */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-[#ded5ea] bg-[#faf8fc] p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-[#837b8f]">Verdict</span>
                  <div className="mt-0.5 text-base font-extrabold text-[#1f192b]">
                    {selectedRowItem.verdict || "N/A"}
                  </div>
                </div>
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-[#6d28d9]">Overall Score</span>
                  <div className="mt-0.5 text-base font-extrabold text-[#6d28d9]">
                    {selectedRowItem.overall_score ?? "N/A"}/100
                  </div>
                </div>
                <div className="rounded-xl border border-[#ded5ea] bg-[#faf8fc] p-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-[#837b8f]">Completeness</span>
                  <div className="mt-0.5 text-base font-extrabold capitalize text-[#463e52]">
                    {selectedRowItem.completeness_status || "N/A"}
                  </div>
                </div>
              </div>

              {/* Multi-Agent Dimension Breakdown */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#837b8f]">
                  Sub-Agent Scores
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between rounded-xl border border-[#ded5ea] px-3 py-2">
                    <span className="text-[#5e566d]">Relevance</span>
                    <span className="font-bold text-[#6d28d9]">{selectedRowItem.scores?.relevance ?? "N/A"}/100</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[#ded5ea] px-3 py-2">
                    <span className="text-[#5e566d]">Accuracy</span>
                    <span className="font-bold text-emerald-700">{selectedRowItem.scores?.accuracy ?? "N/A"}/100</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[#ded5ea] px-3 py-2">
                    <span className="text-[#5e566d]">Completeness</span>
                    <span className="font-bold text-blue-700">{selectedRowItem.scores?.completeness ?? "N/A"}/100</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-[#ded5ea] px-3 py-2">
                    <span className="text-[#5e566d]">Hallucination Risk</span>
                    <span className="font-bold text-rose-600">{selectedRowItem.scores?.hallucinationRisk ?? "N/A"}/100</span>
                  </div>
                </div>
              </div>

              {/* Actions in Inspector */}
              <div className="flex items-center justify-between pt-2 border-t border-[#f1ebf7]">
                <button
                  onClick={() => setSelectedRowItem(null)}
                  className="rounded-full px-4 py-1.5 text-xs font-medium text-[#5e566d] hover:bg-slate-100"
                >
                  Close
                </button>
                {selectedRowItem.id && (
                  <button
                    onClick={() => {
                      setLocation(`/evaluate?id=${selectedRowItem.id}`);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#6d28d9] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#5b21b6] transition-all"
                  >
                    Open Full Multi-Agent Deep Dive <ExternalLink size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Past Batch Runs History Section */}
        <div className="rounded-3xl border border-[#ded5ea] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#f1ebf7] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-[#6d28d9]">
                <Clock size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#1f192b]">Past Batch Runs</h3>
                <p className="text-xs text-[#837b8f]">
                  Historical batches evaluated and stored in PostgreSQL
                </p>
              </div>
            </div>
            <button
              onClick={fetchHistory}
              disabled={isLoadingHistory}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#5e566d] hover:text-[#6d28d9]"
            >
              <RefreshCw size={12} className={isLoadingHistory ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {historyRuns.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#837b8f]">
              {isLoadingHistory ? "Loading batch history..." : "No past batch evaluations recorded yet."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {historyRuns.map((b) => (
                <div
                  key={b.batch_id}
                  className="rounded-2xl border border-[#ded5ea] bg-[#faf8fc] p-4 hover:border-purple-300 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-[#6d28d9]">
                      {b.batch_id.slice(0, 14)}...
                    </span>
                    <span className="text-[10px] text-[#837b8f]">
                      {b.started_at ? new Date(b.started_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="text-[#5e566d] font-medium">{b.total} items</span>
                    <span className="font-bold text-[#1f192b]">Avg: {b.avg_score}/100</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 size={10} /> {b.pass}
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      <AlertTriangle size={10} /> {b.review}
                    </span>
                    <span className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      <XCircle size={10} /> {b.fail}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

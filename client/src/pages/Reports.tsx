import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  FileCheck,
  FileText,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { getEvaluationHistory, getEvaluation, getSinglePDFUrl, type HistoryItem, type EvaluationRecord } from "@/services/api";
import { toast } from "sonner";

export default function Reports() {
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    getEvaluationHistory({ limit: 50 })
      .then((data) => {
        setHistoryItems(data.items);
        if (data.items.length > 0) {
          loadReport(data.items[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load reports history:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const loadReport = async (id: string) => {
    setLoadingReport(true);
    try {
      const record = await getEvaluation(id);
      setSelectedEvaluation(record);
    } catch (err: any) {
      toast.error("Failed to load audit report: " + err.message);
    } finally {
      setLoadingReport(false);
    }
  };

  const handleExportJSON = () => {
    if (!selectedEvaluation) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedEvaluation, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `veriai-report-${selectedEvaluation.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Audit report exported as JSON.");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout
      eyebrow="Compliance & Audit"
      title="Evaluation Reports"
      subtitle="Comprehensive audit-ready reports of multi-agent evaluations with evidence provenance and claim verifications."
      actions={
        selectedEvaluation && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#ded5ea] bg-white px-3.5 py-1.5 text-xs font-bold text-[#564e62] hover:bg-[#f6f2fd] hover:text-[#6d28d9]"
            >
              <Download size={13} /> Export JSON
            </button>
            <a
              href={getSinglePDFUrl(selectedEvaluation.id)}
              download={`VeriAI_Report_${selectedEvaluation.id}.pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#6d28d9] px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#5b21b6]"
            >
              <FileCheck size={13} /> Download PDF Report (M4.2)
            </a>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#ded5ea] bg-white px-3.5 py-1.5 text-xs font-bold text-[#564e62] hover:bg-[#f6f2fd]"
            >
              <Printer size={13} /> Print
            </button>
          </div>
        )
      }
    >
      {loading ? (
        <div className="py-16 text-center text-xs text-[#837b8f]">
          <RefreshCw size={20} className="mx-auto mb-2 animate-spin text-[#6d28d9]" />
          Loading evaluation reports...
        </div>
      ) : historyItems.length === 0 ? (
        <div className="rounded-3xl border border-[#ece5f4] bg-white p-12 text-center shadow-sm">
          <FileText size={24} className="mx-auto text-[#6d28d9]" />
          <h3 className="mt-3 font-display text-sm font-bold text-[#1c1724]">
            No evaluation reports available.
          </h3>
          <p className="mt-1 text-xs text-[#797184]">
            Run an evaluation in the studio to generate audit reports.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column: Select report from history */}
          <div className="rounded-3xl border border-[#ece5f4] bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#797183] mb-3">
              Audited Evaluations ({historyItems.length})
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {historyItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => loadReport(item.id)}
                  className={`flex w-full flex-col text-left rounded-2xl border p-3.5 transition ${
                    selectedEvaluation?.id === item.id
                      ? "border-[#6d28d9] bg-[#faf7fd] shadow-xs"
                      : "border-[#ece5f4] bg-white hover:border-[#6d28d9]/40 hover:bg-[#fcfbfe]"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono text-[#8a8296]">{item.id}</span>
                    <span
                      className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                        item.verdict === "PASS"
                          ? "bg-emerald-50 text-emerald-700"
                          : item.verdict === "REVIEW"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {item.verdict} ({item.overallScore})
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-semibold text-[#1a1523] line-clamp-2">
                    {item.question}
                  </div>
                  <div className="mt-2 text-[10px] text-[#8e879b]">
                    {item.evaluatedAt}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Full Report Document */}
          <div className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm sm:p-8 lg:col-span-2">
            {loadingReport || !selectedEvaluation ? (
              <div className="py-16 text-center text-xs text-[#837b8f]">
                <RefreshCw size={20} className="mx-auto mb-2 animate-spin text-[#6d28d9]" />
                Loading audit report...
              </div>
            ) : (
              <div className="space-y-6 print:space-y-4">
                {/* Report Header */}
                <div className="border-b border-[#ece5f4] pb-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#6d28d9]">
                      <ShieldCheck size={20} />
                      <span className="font-display font-bold text-sm tracking-tight text-[#17151c]">
                        VeriAI Verification Report
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[#7f788b]">
                      Ref: {selectedEvaluation.id}
                    </span>
                  </div>

                  <h1 className="mt-3 font-display text-xl font-bold text-[#17151c] sm:text-2xl">
                    {selectedEvaluation.question}
                  </h1>
                  <div className="mt-1 text-xs text-[#746c80]">
                    Evaluated on {selectedEvaluation.evaluatedAt} · Confidence: {selectedEvaluation.confidence}
                  </div>
                </div>

                {/* Score & Verdict Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-4 text-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#888194]">Overall Score</span>
                    <div className="mt-1 font-display text-2xl font-bold text-[#6d28d9]">
                      {selectedEvaluation.overallScore} / 100
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#888194]">Verdict</span>
                    <div className="mt-1 font-display text-2xl font-bold text-[#17151c]">
                      {selectedEvaluation.verdict}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#888194]">Accuracy</span>
                    <div className="mt-1 font-display text-2xl font-bold text-[#16a34a]">
                      {selectedEvaluation.scores.accuracy}%
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#888194]">Hallucination Risk</span>
                    <div className="mt-1 font-display text-2xl font-bold text-amber-600">
                      {selectedEvaluation.scores.hallucinationRisk}%
                    </div>
                  </div>
                </div>

                {/* AI Response Box */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6d6578] mb-1.5">
                    Evaluated AI Response
                  </h3>
                  <div className="rounded-xl border border-[#ded7e8] bg-[#fbfafc] p-3 text-xs leading-relaxed text-[#2c2637]">
                    {selectedEvaluation.aiResponse}
                  </div>
                </div>

                {/* Reference Answer Box */}
                {selectedEvaluation.referenceAnswer && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#6d6578] mb-1.5">
                      Ground Truth Reference Answer
                    </h3>
                    <div className="rounded-xl border border-[#ded7e8] bg-[#fbfafc] p-3 text-xs leading-relaxed text-[#2c2637]">
                      {selectedEvaluation.referenceAnswer}
                    </div>
                  </div>
                )}

                {/* Jury Reasons */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6d6578] mb-2">
                    Jury Reasons & Rationales
                  </h3>
                  <div className="space-y-1.5 text-xs">
                    {selectedEvaluation.reasons.map((r, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 rounded-lg border p-2.5 ${
                          r.positive
                            ? "border-emerald-200 bg-emerald-50/50 text-emerald-900"
                            : "border-amber-200 bg-amber-50/50 text-amber-900"
                        }`}
                      >
                        <span className="mt-0.5">{r.positive ? "✓" : "⚠"}</span>
                        <span>{r.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Claims Verification Table */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#6d6578] mb-2">
                    Claim Verification Breakdown
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-[#ece5f4]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-[#faf8fd] border-b border-[#eee8f5] text-[10px] font-bold uppercase text-[#8a8296]">
                          <th className="py-2.5 pl-3">Claim</th>
                          <th className="py-2.5">Status</th>
                          <th className="py-2.5">Evidence Excerpt</th>
                          <th className="py-2.5 pr-3">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f2ecf8]">
                        {selectedEvaluation.claims.map((c) => (
                          <tr key={c.id}>
                            <td className="py-2.5 pl-3 font-medium text-[#1e1828] max-w-xs">
                              {c.claim}
                            </td>
                            <td className="py-2.5 uppercase text-[10px] font-bold">
                              {c.status}
                            </td>
                            <td className="py-2.5 font-mono text-[11px] text-[#4d4659] max-w-sm truncate">
                              {c.evidenceText || "N/A"}
                            </td>
                            <td className="py-2.5 pr-3 text-[#776f82]">
                              {c.source}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

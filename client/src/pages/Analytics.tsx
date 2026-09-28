import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  PieChart,
  RefreshCw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { getDashboardStats, type DashboardStats } from "@/services/api";

export default function Analytics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <AppLayout
      eyebrow="Evaluation Intelligence"
      title="Analytics & Benchmarks"
      subtitle="Factual reliability trends, verdict distributions, and metric averages computed from PostgreSQL evaluation records."
      actions={
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#ded5ea] bg-white px-3.5 py-1.5 text-xs font-bold text-[#5e566d] hover:bg-[#f6f2fd] hover:text-[#6d28d9] disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      }
    >
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="py-16 text-center text-xs text-[#837b8f]">
          <RefreshCw size={20} className="mx-auto mb-2 animate-spin text-[#6d28d9]" />
          Aggregating analytics from PostgreSQL...
        </div>
      ) : !stats || stats.total_evaluations === 0 ? (
        <div className="rounded-3xl border border-[#ece5f4] bg-white p-12 text-center shadow-sm">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6f2fd] text-[#6d28d9]">
            <BarChart3 size={24} />
          </div>
          <h3 className="mt-3 font-display text-sm font-bold text-[#1c1724]">
            No evaluation data available yet.
          </h3>
          <p className="mt-1 text-xs text-[#797184] max-w-sm mx-auto">
            Once you execute evaluations in the studio, real-time analytics, accuracy distributions, and reliability trends will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Top 4 Performance Averages */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#ece5f4] bg-white p-5 shadow-sm text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b8498]">
                Average Accuracy
              </span>
              <div className="mt-2 font-display text-3xl font-bold text-[#16a34a]">
                {stats.avg_accuracy}%
              </div>
              <span className="text-[10px] text-[#736c80]">Claim verification rate</span>
            </div>

            <div className="rounded-2xl border border-[#ece5f4] bg-white p-5 shadow-sm text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b8498]">
                Average Relevance
              </span>
              <div className="mt-2 font-display text-3xl font-bold text-[#6d28d9]">
                {stats.avg_relevance}%
              </div>
              <span className="text-[10px] text-[#736c80]">Prompt-to-evidence match</span>
            </div>

            <div className="rounded-2xl border border-[#ece5f4] bg-white p-5 shadow-sm text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b8498]">
                Average Completeness
              </span>
              <div className="mt-2 font-display text-3xl font-bold text-blue-600">
                {stats.avg_completeness}%
              </div>
              <span className="text-[10px] text-[#736c80]">Key concept coverage</span>
            </div>

            <div className="rounded-2xl border border-[#ece5f4] bg-white p-5 shadow-sm text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#8b8498]">
                Avg Hallucination Risk
              </span>
              <div
                className={`mt-2 font-display text-3xl font-bold ${
                  stats.avg_hallucination_risk > 30 ? "text-amber-600" : "text-[#16a34a]"
                }`}
              >
                {stats.avg_hallucination_risk}%
              </div>
              <span className="text-[10px] text-[#736c80]">Unsupported statements</span>
            </div>
          </div>

          {/* Verdict Distribution Section */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Breakdown Visualizer */}
            <div className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm">
              <h2 className="font-display text-base font-bold text-[#17151c] mb-1">
                Verdict Distribution ({stats.total_evaluations} Total Runs)
              </h2>
              <p className="text-xs text-[#756d81] mb-6">
                Breakdown of PASS, REVIEW, and FAIL decisions made by VerdictAgent.
              </p>

              <div className="space-y-4">
                {/* PASS bar */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> PASS ({stats.verdict_distribution.PASS})
                    </span>
                    <span className="text-[#17151c]">
                      {((stats.verdict_distribution.PASS / stats.total_evaluations) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-emerald-100 overflow-hidden">
                    <div
                      className="h-full bg-[#16a34a] rounded-full transition-all duration-500"
                      style={{
                        width: `${(stats.verdict_distribution.PASS / stats.total_evaluations) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* REVIEW bar */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-amber-700 flex items-center gap-1.5">
                      <AlertCircle size={13} /> REVIEW ({stats.verdict_distribution.REVIEW})
                    </span>
                    <span className="text-[#17151c]">
                      {((stats.verdict_distribution.REVIEW / stats.total_evaluations) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-amber-100 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${(stats.verdict_distribution.REVIEW / stats.total_evaluations) * 100}%`,
                      }}
                    />
                  </div>
                </div>

                {/* FAIL bar */}
                <div>
                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                    <span className="text-rose-700 flex items-center gap-1.5">
                      <XCircle size={13} /> FAIL ({stats.verdict_distribution.FAIL})
                    </span>
                    <span className="text-[#17151c]">
                      {((stats.verdict_distribution.FAIL / stats.total_evaluations) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-rose-100 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all duration-500"
                      style={{
                        width: `${(stats.verdict_distribution.FAIL / stats.total_evaluations) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-4 text-xs text-[#5e566d]">
                <strong>Reliability Index:</strong> Based on current evaluation history,{" "}
                <strong>{stats.pass_rate}%</strong> of tested answers strictly passed multi-agent grounding checks.
              </div>
            </div>

            {/* Knowledge Base Grounding Coverage */}
            <div className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm">
              <h2 className="font-display text-base font-bold text-[#17151c] mb-1">
                Knowledge Base Indexing Health
              </h2>
              <p className="text-xs text-[#756d81] mb-6">
                Vector coverage and embedding capacity backing the evaluation jury.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#ede7f5] bg-[#faf8fd] p-4">
                  <span className="text-[10px] font-bold uppercase text-[#888195]">Total Chunks</span>
                  <div className="mt-1 font-display text-2xl font-bold text-[#17151c]">
                    {stats.kb_stats.chunks.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-[#71697d]">Windowed text slices</span>
                </div>

                <div className="rounded-2xl border border-[#ede7f5] bg-[#faf8fd] p-4">
                  <span className="text-[10px] font-bold uppercase text-[#888195]">Dense Vectors</span>
                  <div className="mt-1 font-display text-2xl font-bold text-[#6d28d9]">
                    {stats.kb_stats.embeddings.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-[#71697d]">BGE-small 384d</span>
                </div>

                <div className="rounded-2xl border border-[#ede7f5] bg-[#faf8fd] p-4">
                  <span className="text-[10px] font-bold uppercase text-[#888195]">Documents</span>
                  <div className="mt-1 font-display text-2xl font-bold text-[#17151c]">
                    {stats.kb_stats.documents.toLocaleString()}
                  </div>
                  <span className="text-[10px] text-[#71697d]">SQuAD + TruthfulQA</span>
                </div>

                <div className="rounded-2xl border border-[#ede7f5] bg-[#faf8fd] p-4">
                  <span className="text-[10px] font-bold uppercase text-[#888195]">Index Method</span>
                  <div className="mt-1 font-display text-2xl font-bold text-[#16a34a]">
                    HNSW
                  </div>
                  <span className="text-[10px] text-[#71697d]">Cosine distance</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

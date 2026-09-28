import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  FileCheck2,
  Layers,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { getDashboardStats, type DashboardStats } from "@/services/api";
import { useEvaluation } from "@/contexts/EvaluationContext";
import { toast } from "sonner";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { loadEvaluationById } = useEvaluation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [verdictFilter, setVerdictFilter] = useState<string>("ALL");
  const [batchIdFilter, setBatchIdFilter] = useState<string>("");

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getDashboardStats({
        verdict: verdictFilter !== "ALL" ? verdictFilter : undefined,
        batch_id: batchIdFilter.trim() || undefined,
      });
      setStats(data);
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setError(err.message || "Unable to connect to VeriAI backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [verdictFilter, batchIdFilter]);

  const handleOpenEvaluation = async (id: string) => {
    try {
      await loadEvaluationById(id);
      setLocation(`/evaluate?id=${id}`);
    } catch (err: any) {
      toast.error("Failed to load evaluation: " + err.message);
    }
  };

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case "PASS":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={12} /> PASS
          </span>
        );
      case "REVIEW":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700">
            <AlertCircle size={12} /> REVIEW
          </span>
        );
      case "FAIL":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
            <XCircle size={12} /> FAIL
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
            {verdict}
          </span>
        );
    }
  };

  return (
    <AppLayout
      eyebrow="Real-Time Oversight & Analytics"
      title="Evaluation Scoring Dashboard (M4.1)"
      subtitle="Visualizing pass/fail rates, dimension score distributions, hallucination frequency, and completeness trends across single & batch evaluations."
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStats}
            disabled={loading}
            title="Refresh statistics"
            className="grid size-9 place-items-center rounded-full border border-[#e5dfef] bg-white text-[#655d71] transition hover:bg-[#f6f2fd] hover:text-[#6d28d9] disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setLocation("/evaluate")}
            className="inline-flex items-center gap-2 rounded-full bg-[#6d28d9] px-4 py-2 text-xs font-bold text-white shadow-sm shadow-[#6d28d9]/30 transition hover:bg-[#5b21b6]"
          >
            <Play size={13} /> Evaluate a Response
          </button>
        </div>
      }
    >
      {/* Filters Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#ece6f5] bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#797184]">
            Dashboard Filters:
          </span>
          <select
            value={verdictFilter}
            onChange={(e) => setVerdictFilter(e.target.value)}
            className="rounded-xl border border-[#ded5ea] bg-[#faf8fd] px-3 py-1.5 text-xs font-bold text-[#17151c] focus:outline-none focus:ring-2 focus:ring-[#6d28d9]"
          >
            <option value="ALL">All Verdicts</option>
            <option value="PASS">PASS Only</option>
            <option value="REVIEW">REVIEW Only</option>
            <option value="FAIL">FAIL Only</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter by Batch ID (e.g. batch-123)"
            value={batchIdFilter}
            onChange={(e) => setBatchIdFilter(e.target.value)}
            className="rounded-xl border border-[#ded5ea] bg-[#faf8fd] px-3 py-1.5 text-xs text-[#17151c] focus:outline-none focus:ring-2 focus:ring-[#6d28d9] w-64"
          />
          {batchIdFilter && (
            <button
              onClick={() => setBatchIdFilter("")}
              className="text-xs text-[#797184] hover:text-[#6d28d9] font-bold"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchStats}
            className="font-bold underline hover:text-red-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !stats && (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-[#eee8f5]" />
            ))}
          </div>
          <div className="h-44 rounded-3xl bg-[#eee8f5]" />
          <div className="h-64 rounded-3xl bg-[#eee8f5]" />
        </div>
      )}

      {stats && (
        <div className="space-y-8">
          {/* Top Performance Stats Grid (6 KPIs) */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#797184]">
                Aggregated Evaluation Statistics (Database Verified)
              </h2>
              <span className="text-[11px] text-[#8e869a]">
                Evaluated {stats.total_evaluations} total response record(s)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 sm:gap-3">
              <div className="rounded-2xl border border-[#ece6f5] bg-white p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8b8496]">
                  Total Evaluated
                </div>
                <div className="mt-2 font-display text-2xl font-bold text-[#17151c]">
                  {stats.total_evaluations}
                </div>
                <div className="mt-1 text-[10px] text-[#736b80]">Audited responses</div>
              </div>

              <div className="rounded-2xl border border-[#ece6f5] bg-white p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8b8496]">
                  Pass Rate
                </div>
                <div className="mt-2 font-display text-2xl font-bold text-[#16a34a]">
                  {stats.total_evaluations > 0 ? `${stats.pass_rate}%` : "—"}
                </div>
                <div className="mt-1 text-[10px] text-[#736b80]">
                  {stats.verdict_distribution.PASS} PASS verdicts
                </div>
              </div>

              <div className="rounded-2xl border border-[#ece6f5] bg-white p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8b8496]">
                  Avg. Accuracy
                </div>
                <div className="mt-2 font-display text-2xl font-bold text-[#6d28d9]">
                  {stats.total_evaluations > 0 ? `${stats.avg_accuracy}%` : "—"}
                </div>
                <div className="mt-1 text-[10px] text-[#736b80]">Factual grounding</div>
              </div>

              <div className="rounded-2xl border border-[#ece6f5] bg-white p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8b8496]">
                  Avg. Relevance
                </div>
                <div className="mt-2 font-display text-2xl font-bold text-blue-600">
                  {stats.total_evaluations > 0 ? `${stats.avg_relevance}%` : "—"}
                </div>
                <div className="mt-1 text-[10px] text-[#736b80]">Query alignment</div>
              </div>

              <div className="rounded-2xl border border-[#ece6f5] bg-white p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8b8496]">
                  Avg. Completeness
                </div>
                <div className="mt-2 font-display text-2xl font-bold text-indigo-600">
                  {stats.total_evaluations > 0 ? `${stats.avg_completeness}%` : "—"}
                </div>
                <div className="mt-1 text-[10px] text-[#736b80]">Coverage score</div>
              </div>

              <div className="rounded-2xl border border-[#ece6f5] bg-white p-4 shadow-sm">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8b8496]">
                  Hallucination Risk
                </div>
                <div
                  className={`mt-2 font-display text-2xl font-bold ${
                    stats.avg_hallucination_risk > 30 ? "text-amber-600" : "text-[#16a34a]"
                  }`}
                >
                  {stats.total_evaluations > 0 ? `${stats.avg_hallucination_risk}%` : "—"}
                </div>
                <div className="mt-1 text-[10px] text-[#736b80]">Unsupported rate</div>
              </div>
            </div>
          </section>

          {/* Milestone 4.1 Visualization Widgets Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Widget 1: Hallucination Statistics & Frequency */}
            <section className="rounded-3xl border border-[#ece6f5] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#f0ebf7] pb-3">
                <div className="flex items-center gap-2 text-[#d97706]">
                  <ShieldAlert size={18} />
                  <h3 className="font-display text-sm font-bold text-[#17151c]">
                    Hallucination Detection Frequency & Statistics
                  </h3>
                </div>
              </div>

              {stats.hallucination_stats ? (
                <div className="mt-4 space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[#fef3c7] bg-[#fffbeb] p-3 text-center">
                      <span className="text-[10px] font-bold uppercase text-[#92400e]">
                        Flagged Responses
                      </span>
                      <div className="mt-1 font-display text-xl font-bold text-[#b45309]">
                        {stats.hallucination_stats.responses_with_hallucinations} (
                        {stats.hallucination_stats.hallucination_percentage}%)
                      </div>
                    </div>

                    <div className="rounded-2xl border border-[#fee2e2] bg-[#fef2f2] p-3 text-center">
                      <span className="text-[10px] font-bold uppercase text-[#991b1b]">
                        Unsupported Claims
                      </span>
                      <div className="mt-1 font-display text-xl font-bold text-[#dc2626]">
                        {stats.hallucination_stats.total_unsupported_claims}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-4.5">
                    <div className="flex justify-between font-bold text-[#17151c] mb-1 text-xs">
                      <span>Unsupported Claim Frequency Across Corpus</span>
                      <span>
                        {stats.hallucination_stats.total_unsupported_claims +
                          stats.hallucination_stats.total_contradicted_claims}{" "}
                        Total Claims
                      </span>
                    </div>
                    <p className="text-[11px] text-[#736c80] leading-relaxed">
                      Hallucination detection agent flags assertions that lack semantic retrieval context or directly contradict canonical ground truth in pgvector.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-[#837b8f]">No hallucination stats available</div>
              )}
            </section>

            {/* Widget 2: Completeness Gaps & Missing Information Distribution */}
            <section className="rounded-3xl border border-[#ece6f5] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#f0ebf7] pb-3">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Layers size={18} />
                  <h3 className="font-display text-sm font-bold text-[#17151c]">
                    Completeness Breakdown & Missing Aspects
                  </h3>
                </div>
              </div>

              {stats.completeness_distribution ? (
                <div className="mt-4 space-y-4 text-xs">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase">Fully Covered</span>
                      <div className="mt-1 font-bold text-emerald-900 text-lg">
                        {stats.completeness_distribution.complete}
                      </div>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5">
                      <span className="text-[10px] font-bold text-amber-800 uppercase">Partially Addressed</span>
                      <div className="mt-1 font-bold text-amber-900 text-lg">
                        {stats.completeness_distribution.partial}
                      </div>
                    </div>
                    <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-2.5">
                      <span className="text-[10px] font-bold text-rose-800 uppercase">Incomplete Gaps</span>
                      <div className="mt-1 font-bold text-rose-900 text-lg">
                        {stats.completeness_distribution.incomplete}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-[#17151c] mb-2 text-xs">
                      Frequently Missing Information Aspects:
                    </h4>
                    {Object.keys(stats.completeness_distribution.missing_aspects_freq || {}).length > 0 ? (
                      <div className="space-y-1.5">
                        {Object.entries(stats.completeness_distribution.missing_aspects_freq).slice(0, 4).map(([aspect, freq], i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-[#ece5f4] bg-[#faf8fd] px-3 py-1.5 text-[11px]">
                            <span className="font-medium text-[#2c2538] line-clamp-1">{aspect}</span>
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-[10px]">{freq} occurrences</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-[#ded7e8] p-3 text-center text-[11px] text-[#81798e]">
                        No major recurring missing aspects identified in evaluated responses.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-[#837b8f]">No completeness distribution available</div>
              )}
            </section>
          </div>

          {/* Top Recurring Evaluation Issues & Score Distributions */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Recurring Evaluation Issues */}
            <section className="rounded-3xl border border-[#ece6f5] bg-white p-6 shadow-sm">
              <h3 className="font-display text-sm font-bold text-[#17151c] border-b border-[#f0ebf7] pb-3 mb-4">
                Most Frequently Occurring Evaluation Weaknesses
              </h3>

              {stats.top_issues && stats.top_issues.length > 0 ? (
                <div className="space-y-3">
                  {stats.top_issues.map((item, idx) => (
                    <div key={idx} className="space-y-1 text-xs">
                      <div className="flex justify-between font-bold text-[#2d2639]">
                        <span>{item.issue}</span>
                        <span className="text-[#6d28d9]">{item.count} affected ({item.percentage}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#f0ebf7] overflow-hidden">
                        <div
                          className="h-full bg-[#6d28d9] rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-[#837b8f]">
                  No systemic weaknesses or recurring low-score issues detected.
                </div>
              )}
            </section>

            {/* Score Bucket Distribution */}
            <section className="rounded-3xl border border-[#ece6f5] bg-white p-6 shadow-sm">
              <h3 className="font-display text-sm font-bold text-[#17151c] border-b border-[#f0ebf7] pb-3 mb-4">
                Overall Quality Score Distribution
              </h3>

              {stats.score_distribution ? (
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="flex justify-between font-bold text-emerald-800 mb-1">
                      <span>90 - 100 Score (High Quality)</span>
                      <span>{stats.score_distribution["90_100"]} responses</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-emerald-100 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${(stats.score_distribution["90_100"] / Math.max(1, stats.total_evaluations)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-blue-800 mb-1">
                      <span>75 - 89 Score (Acceptable)</span>
                      <span>{stats.score_distribution["75_89"]} responses</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-blue-100 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${(stats.score_distribution["75_89"] / Math.max(1, stats.total_evaluations)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-amber-800 mb-1">
                      <span>50 - 74 Score (Needs Improvement)</span>
                      <span>{stats.score_distribution["50_74"]} responses</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-amber-100 overflow-hidden">
                      <div
                        className="h-full bg-amber-600 rounded-full"
                        style={{ width: `${(stats.score_distribution["50_74"] / Math.max(1, stats.total_evaluations)) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-rose-800 mb-1">
                      <span>Below 50 Score (Critical Failure)</span>
                      <span>{stats.score_distribution.below_50} responses</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-rose-100 overflow-hidden">
                      <div
                        className="h-full bg-rose-600 rounded-full"
                        style={{ width: `${(stats.score_distribution.below_50 / Math.max(1, stats.total_evaluations)) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          {/* Drill-down Interactive Table */}
          <section className="rounded-3xl border border-[#ece6f5] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#f0ebf7] pb-4">
              <div>
                <h2 className="font-display text-base font-bold text-[#17151c]">
                  Interactive Drill-Down: Evaluated Records
                </h2>
                <p className="mt-0.5 text-xs text-[#736c7e]">
                  Click "Inspect" on any record to drill down from dashboard statistics into claim-by-claim reasoning.
                </p>
              </div>

              {stats.recent_evaluations.length > 0 && (
                <button
                  onClick={() => setLocation("/history")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6d28d9] hover:underline"
                >
                  View all in History <ArrowRight size={13} />
                </button>
              )}
            </div>

            {stats.recent_evaluations.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6f2fd] text-[#6d28d9]">
                  <FileCheck2 size={24} />
                </div>
                <h3 className="mt-3 font-display text-sm font-bold text-[#1c1724]">
                  No matching evaluation records found.
                </h3>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#f0ebf7] text-[11px] font-bold uppercase tracking-wider text-[#8b8498]">
                      <th className="pb-3 pl-2">Question Prompt</th>
                      <th className="pb-3">Verdict</th>
                      <th className="pb-3">Overall Score</th>
                      <th className="pb-3">Accuracy</th>
                      <th className="pb-3">Hallucination Risk</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3 pr-2 text-right">Drill-Down Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f1fa]">
                    {stats.recent_evaluations.map((ev) => (
                      <tr key={ev.id} className="group hover:bg-[#faf7fd] transition">
                        <td className="py-3.5 pl-2 font-medium text-[#201a29] max-w-xs truncate">
                          {ev.question}
                        </td>
                        <td className="py-3.5">{getVerdictBadge(ev.verdict)}</td>
                        <td className="py-3.5 font-bold text-[#17151c]">{ev.score} / 100</td>
                        <td className="py-3.5 font-semibold text-[#16a34a]">{ev.accuracy}%</td>
                        <td className="py-3.5 font-semibold text-amber-600">{ev.hallucinationRisk}%</td>
                        <td className="py-3.5 text-[#81798e]">{ev.date}</td>
                        <td className="py-3.5 pr-2 text-right">
                          <button
                            onClick={() => handleOpenEvaluation(ev.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-[#ded5ea] bg-white px-3 py-1 text-[11px] font-bold text-[#6d28d9] transition group-hover:border-[#6d28d9] hover:bg-[#f6f2fd]"
                          >
                            Inspect <ArrowRight size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </AppLayout>
  );
}

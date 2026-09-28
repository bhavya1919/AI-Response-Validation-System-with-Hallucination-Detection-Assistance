import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { getEvaluationHistory, deleteEvaluation, type HistoryItem } from "@/services/api";
import { useEvaluation } from "@/contexts/EvaluationContext";
import { toast } from "sonner";

export default function History() {
  const [, setLocation] = useLocation();
  const { loadEvaluationById } = useEvaluation();

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and Search
  const [selectedVerdict, setSelectedVerdict] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [counts, setCounts] = useState({ total: 0, pass: 0, review: 0, fail: 0 });

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEvaluationHistory({
        verdict: selectedVerdict !== "ALL" ? selectedVerdict : undefined,
        search: searchQuery.trim() || undefined,
        limit: 100,
      });
      setItems(data.items);
      setCounts({
        total: data.total,
        pass: data.pass_count,
        review: data.review_count,
        fail: data.fail_count,
      });
    } catch (err: any) {
      console.error("Failed to load history:", err);
      setError(err.message || "Unable to connect to VeriAI backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedVerdict]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleOpenEvaluation = async (id: string) => {
    try {
      await loadEvaluationById(id);
      setLocation(`/evaluate?id=${id}`);
    } catch (err: any) {
      toast.error("Failed to load evaluation details.");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this evaluation from the database?")) {
      return;
    }
    try {
      await deleteEvaluation(id);
      toast.success("Evaluation deleted.");
      fetchHistory();
    } catch (err: any) {
      toast.error("Delete failed: " + err.message);
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
      eyebrow="Audit Trail"
      title="Evaluation History"
      subtitle="Complete database record of all multi-agent evaluation runs stored in PostgreSQL."
      actions={
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#ded5ea] bg-white px-3.5 py-1.5 text-xs font-bold text-[#5e566d] hover:bg-[#f6f2fd] hover:text-[#6d28d9] disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      }
    >
      {/* Search and Filters Bar */}
      <div className="mb-6 space-y-4 rounded-3xl border border-[#ece5f4] bg-white p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Search form */}
          <form onSubmit={handleSearch} className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#968fa1]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search evaluations by question text..."
              className="w-full rounded-xl border border-[#ded5ea] bg-[#fbfafc] py-2 pl-10 pr-4 text-xs text-[#17151c] outline-none transition focus:border-[#6d28d9] focus:bg-white"
            />
          </form>

          {/* Verdict Filter Tabs */}
          <div className="flex items-center gap-1 rounded-xl border border-[#ded5ea] bg-[#faf8fd] p-1 text-xs">
            {[
              { id: "ALL", label: `All (${counts.total})` },
              { id: "PASS", label: `Pass (${counts.pass})` },
              { id: "REVIEW", label: `Review (${counts.review})` },
              { id: "FAIL", label: `Fail (${counts.fail})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedVerdict(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedVerdict === tab.id
                    ? "bg-[#6d28d9] text-white shadow-xs"
                    : "text-[#675f73] hover:bg-white hover:text-[#17151c]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-600" />
            <span>{error}</span>
          </div>
          <button onClick={fetchHistory} className="font-bold underline">
            Retry
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="rounded-3xl border border-[#ece5f4] bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-[#837b8f]">
            <RefreshCw size={20} className="mx-auto mb-2 animate-spin text-[#6d28d9]" />
            Loading evaluation records from PostgreSQL...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#f6f2fd] text-[#6d28d9]">
              <Clock size={24} />
            </div>
            <h3 className="mt-3 font-display text-sm font-bold text-[#1c1724]">
              No evaluations found
            </h3>
            <p className="mt-1 text-xs text-[#797184] max-w-sm mx-auto">
              {searchQuery
                ? `No evaluations match your search "${searchQuery}".`
                : "No saved evaluations match the current filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#eee8f5] bg-[#faf8fd] text-[11px] font-bold uppercase tracking-wider text-[#81798d]">
                  <th className="py-3.5 pl-5">Evaluation Question</th>
                  <th className="py-3.5">Verdict</th>
                  <th className="py-3.5">Score</th>
                  <th className="py-3.5">Accuracy</th>
                  <th className="py-3.5">Hallucination Risk</th>
                  <th className="py-3.5">Date</th>
                  <th className="py-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2ecf8]">
                {items.map((ev) => (
                  <tr
                    key={ev.id}
                    onClick={() => handleOpenEvaluation(ev.id)}
                    className="group cursor-pointer hover:bg-[#faf7fd] transition"
                  >
                    <td className="py-4 pl-5">
                      <div className="font-semibold text-[#1e1828] max-w-md truncate">
                        {ev.question}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#867f92] truncate max-w-sm">
                        {ev.aiResponse}
                      </div>
                    </td>
                    <td className="py-4">{getVerdictBadge(ev.verdict)}</td>
                    <td className="py-4 font-bold text-[#17151c]">
                      {ev.overallScore} / 100
                    </td>
                    <td className="py-4 font-semibold text-[#16a34a]">
                      {ev.scores.accuracy}%
                    </td>
                    <td className="py-4 font-semibold text-[#6d28d9]">
                      {ev.scores.hallucinationRisk}%
                    </td>
                    <td className="py-4 text-[#837b90] whitespace-nowrap">
                      {ev.evaluatedAt}
                    </td>
                    <td className="py-4 pr-5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEvaluation(ev.id);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-[#ded5ea] bg-white px-3 py-1 text-[11px] font-bold text-[#6d28d9] group-hover:border-[#6d28d9] hover:bg-[#f6f2fd]"
                        >
                          View Result <ArrowRight size={11} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(ev.id, e)}
                          title="Delete from database"
                          className="grid size-7 place-items-center rounded-lg text-[#958ea0] transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

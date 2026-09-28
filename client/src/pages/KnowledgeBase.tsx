import React, { useState, useEffect } from "react";
import {
  BookOpen,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import {
  getKnowledgeBaseStats,
  searchKnowledgeBase,
  type KnowledgeSearchResult,
} from "@/services/api";
import { toast } from "sonner";

export default function KnowledgeBase() {
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Search / Test Retrieval State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDataset, setSelectedDataset] = useState<string>("all");
  const [topK, setTopK] = useState(5);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[] | null>(null);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const data = await getKnowledgeBaseStats();
      setStats(data);
    } catch (err: any) {
      console.error("Failed to load KB stats:", err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleTestSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast.error("Please enter a search query.");
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchKnowledgeBase({
        query: searchQuery.trim(),
        dataset: selectedDataset !== "all" ? selectedDataset : undefined,
        top_k: topK,
      });
      setSearchResults(results);
      toast.success(`Retrieved ${results.length} ranked chunks via pgvector.`);
    } catch (err: any) {
      toast.error("Retrieval failed: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopyChunk = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Evidence passage copied to clipboard.");
  };

  return (
    <AppLayout
      eyebrow="Canonical Knowledge Base"
      title="Knowledge Base & Vector Store"
      subtitle="Ground truth corpuses indexed using BGE-small-en-v1.5 dense embeddings and pgvector HNSW cosine similarity."
    >
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 mb-8">
        <div className="rounded-2xl border border-[#ece5f4] bg-white p-4 shadow-sm text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a8296]">
            Knowledge Sources
          </span>
          <div className="mt-1 font-display text-2xl font-bold text-[#17151c]">
            {loadingStats ? "…" : stats?.total_sources || 3}
          </div>
          <span className="text-[11px] text-[#736c7f]">Ground-truth benchmarks</span>
        </div>

        <div className="rounded-2xl border border-[#ece5f4] bg-white p-4 shadow-sm text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a8296]">
            Total Documents
          </span>
          <div className="mt-1 font-display text-2xl font-bold text-[#17151c]">
            {loadingStats ? "…" : stats?.total_documents?.toLocaleString() || "1,001"}
          </div>
          <span className="text-[11px] text-[#736c7f]">Contextual articles</span>
        </div>

        <div className="rounded-2xl border border-[#ece5f4] bg-white p-4 shadow-sm text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a8296]">
            Indexed Chunks
          </span>
          <div className="mt-1 font-display text-2xl font-bold text-[#6d28d9]">
            {loadingStats ? "…" : stats?.total_chunks?.toLocaleString() || "2,066"}
          </div>
          <span className="text-[11px] text-[#736c7f]">Windowed passages</span>
        </div>

        <div className="rounded-2xl border border-[#ece5f4] bg-white p-4 shadow-sm text-center">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8a8296]">
            pgvector Index
          </span>
          <div className="mt-1 font-display text-2xl font-bold text-[#16a34a]">
            HNSW
          </div>
          <span className="text-[11px] text-[#736c7f]">384-dimensional cosine</span>
        </div>
      </div>

      {/* Certified Datasets Section */}
      <section className="mb-8 rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm sm:p-8">
        <h2 className="font-display text-base font-bold text-[#17151c] mb-1">
          Ingested Ground Truth Datasets
        </h2>
        <p className="text-xs text-[#736c7e] mb-6">
          Certified reference data used to evaluate AI statements and prevent hallucinated falsehoods.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {/* SQuAD */}
          <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#6d28d9]/10 px-2.5 py-0.5 text-xs font-bold text-[#6d28d9]">
                  SQuAD v1.1
                </span>
                <span className="text-[11px] font-bold text-[#16a34a]">Active</span>
              </div>
              <h3 className="mt-3 font-display text-sm font-bold text-[#1a1423]">
                Stanford Question Answering
              </h3>
              <p className="mt-1 text-xs text-[#6e677a] leading-relaxed">
                Reading comprehension articles extracted from Wikipedia. Evaluates contextual factual extraction and question answering.
              </p>
            </div>
            <div className="mt-4 border-t border-[#ede7f4] pt-3 text-[11px] text-[#867f92]">
              <div>Documents: <strong>501</strong></div>
              <div>Sample split: Train / Benchmark</div>
            </div>
          </div>

          {/* TruthfulQA */}
          <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#16a34a]/10 px-2.5 py-0.5 text-xs font-bold text-[#16a34a]">
                  TruthfulQA
                </span>
                <span className="text-[11px] font-bold text-[#16a34a]">Active</span>
              </div>
              <h3 className="mt-3 font-display text-sm font-bold text-[#1a1423]">
                Misconception & Factuality Benchmark
              </h3>
              <p className="mt-1 text-xs text-[#6e677a] leading-relaxed">
                Curated factual questions across 38 categories designed to test whether an LLM mimics common human false beliefs or conspiracy myths.
              </p>
            </div>
            <div className="mt-4 border-t border-[#ede7f4] pt-3 text-[11px] text-[#867f92]">
              <div>Documents: <strong>500</strong></div>
              <div>Categories: Health, Law, Science</div>
            </div>
          </div>

          {/* VeriAI Docs */}
          <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-md bg-[#6d28d9]/10 px-2.5 py-0.5 text-xs font-bold text-[#6d28d9]">
                  VeriAI Docs
                </span>
                <span className="text-[11px] font-bold text-[#16a34a]">Active</span>
              </div>
              <h3 className="mt-3 font-display text-sm font-bold text-[#1a1423]">
                Platform Architecture & Guidelines
              </h3>
              <p className="mt-1 text-xs text-[#6e677a] leading-relaxed">
                Platform documentation, multi-agent evaluation criteria, hallucination threshold rubrics, and custom organizational data.
              </p>
            </div>
            <div className="mt-4 border-t border-[#ede7f4] pt-3 text-[11px] text-[#867f92]">
              <div>Documents: <strong>Custom / Dynamic</strong></div>
              <div>Type: Internal Guidelines</div>
            </div>
          </div>
        </div>
      </section>

      {/* Test Semantic Retrieval Section */}
      <section className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm sm:p-8">
        <div className="border-b border-[#f0ebf7] pb-4 mb-6">
          <div className="flex items-center gap-2 text-[#6d28d9]">
            <Search size={18} />
            <h2 className="font-display text-base font-bold text-[#17151c]">
              Test Semantic Retrieval
            </h2>
          </div>
          <p className="mt-1 text-xs text-[#736c7e]">
            Execute direct semantic vector search against the pgvector index (`POST /api/knowledge/search`).
          </p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleTestSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#968fa1]"
              />
              <input
                type="text"
                required
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter query to test retrieval (e.g. Neil Armstrong moon words)..."
                className="w-full rounded-xl border border-[#ded5ea] bg-[#fbfafc] py-2.5 pl-10 pr-4 text-xs text-[#17151c] outline-none transition focus:border-[#6d28d9] focus:bg-white"
              />
            </div>

            {/* Dataset Selector */}
            <select
              value={selectedDataset}
              onChange={(e) => setSelectedDataset(e.target.value)}
              className="rounded-xl border border-[#ded5ea] bg-white px-3 py-2.5 text-xs text-[#484054] outline-none focus:border-[#6d28d9]"
            >
              <option value="all">All Datasets</option>
              <option value="squad">SQuAD</option>
              <option value="truthfulqa">TruthfulQA</option>
            </select>

            {/* Top K Selector */}
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="rounded-xl border border-[#ded5ea] bg-white px-3 py-2.5 text-xs text-[#484054] outline-none focus:border-[#6d28d9]"
            >
              <option value={3}>Top 3</option>
              <option value={5}>Top 5</option>
              <option value={8}>Top 8</option>
              <option value={12}>Top 12</option>
            </select>

            <button
              type="submit"
              disabled={isSearching}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6d28d9] px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#5b21b6] disabled:opacity-50"
            >
              {isSearching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              Search
            </button>
          </div>
        </form>

        {/* Search Results Display */}
        {searchResults !== null && (
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#625970] border-b border-[#f0ebf7] pb-2">
              <span>Retrieval Results ({searchResults.length} chunks)</span>
              <span>pgvector Cosine Similarity</span>
            </div>

            {searchResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#837b90]">
                No relevant chunks found in the selected scope.
              </div>
            ) : (
              searchResults.map((res, idx) => (
                <div
                  key={res.chunk_id || idx}
                  className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-4 text-xs transition hover:border-[#6d28d9]/40"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-[#eee8f6] pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="grid size-5 place-items-center rounded-md bg-[#6d28d9] text-[10px] font-bold text-white">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-[#1c1725]">{res.source_name}</span>
                      <span className="rounded bg-[#ece5f5] px-2 py-0.5 text-[10px] font-bold uppercase text-[#6d28d9]">
                        {res.dataset}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#16a34a]">
                        {(res.score * 100).toFixed(1)}% match
                      </span>
                      <button
                        onClick={() => handleCopyChunk(res.content)}
                        title="Copy chunk"
                        className="grid size-6 place-items-center rounded text-[#7d7589] hover:bg-white hover:text-[#17151c]"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 font-mono text-[11px] leading-relaxed text-[#2d2737] bg-white rounded-xl border border-[#eee8f5] p-3">
                    {res.content}
                  </div>

                  {res.answer && (
                    <div className="mt-2 text-[11px] text-[#6d667a]">
                      <strong>Reference Answer:</strong> {res.answer}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </AppLayout>
  );
}

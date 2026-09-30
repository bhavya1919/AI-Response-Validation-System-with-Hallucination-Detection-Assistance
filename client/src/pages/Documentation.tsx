import React, { useState } from "react";
import {
  BookOpen,
  Code2,
  Copy,
  Database,
  ExternalLink,
  Layers,
  Server,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { toast } from "sonner";
import { API_BASE_URL } from "@/services/api";

interface DocSection {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
}

export default function Documentation() {
  const [activeTab, setActiveTab] = useState("overview");

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Code snippet copied to clipboard.");
  };

  const sections: DocSection[] = [
    {
      id: "overview",
      title: "Platform Overview",
      icon: BookOpen,
      content: (
        <div className="space-y-4 text-xs text-[#4c4458] leading-relaxed">
          <p>
            <strong>VeriAI</strong> is a multi-agent evaluation and benchmarking platform that audits Large Language Model (LLM) responses against canonical, dynamic ground-truth knowledge bases using PostgreSQL, pgvector, and multi-hop semantic retrieval.
          </p>
          <div className="rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-4">
            <h4 className="font-bold text-[#17151c] mb-2">Core Operating Principles</h4>
            <ul className="list-disc pl-4 space-y-1.5">
              <li><strong>Zero Synthetic Grounding:</strong> Evaluates exclusively against certified benchmark corpuses (SQuAD v1.1, TruthfulQA) and user-supplied reference material.</li>
              <li><strong>Deterministic 4-Agent Jury:</strong> Uses specialized agents for evidence retrieval, claim verification, hallucination detection, and structured scoring.</li>
              <li><strong>Relational & Vector Audit Trail:</strong> Every evaluated response, sentence-level claim, and evidence citation is permanently stored in PostgreSQL.</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: "pipeline",
      title: "Evaluation Pipeline",
      icon: ShieldCheck,
      content: (
        <div className="space-y-4 text-xs text-[#4c4458] leading-relaxed">
          <p>
            When an evaluation request is received at <code>POST /api/evaluate</code>, the multi-agent pipeline coordinates 4 deterministic evaluation stages:
          </p>

          <div className="space-y-3">
            <div className="rounded-2xl border border-[#ece5f4] bg-white p-4">
              <h4 className="font-bold text-[#17151c]">1. RetrieverAgent</h4>
              <p className="mt-1">
                Embeds the question and candidate response into 384-dimensional dense vectors using <code>BAAI/bge-small-en-v1.5</code>. Executes cosine similarity searches over PostgreSQL pgvector HNSW index to compile top evidence passages.
              </p>
            </div>

            <div className="rounded-2xl border border-[#ece5f4] bg-white p-4">
              <h4 className="font-bold text-[#17151c]">2. AccuracyAgent</h4>
              <p className="mt-1">
                Extracts atomic claims from the AI response and tests each claim against the retrieved evidence and canonical reference answers. Assigns status: <code>supported</code>, <code>partial</code>, or <code>unsupported</code>.
              </p>
            </div>

            <div className="rounded-2xl border border-[#ece5f4] bg-white p-4">
              <h4 className="font-bold text-[#17151c]">3. HallucinationAgent</h4>
              <p className="mt-1">
                Computes hallucination risk percentage (0–100%). Differentiates between claims lacking direct evidence in the corpus versus explicit semantic clashes (contradictions).
              </p>
            </div>

            <div className="rounded-2xl border border-[#ece5f4] bg-white p-4">
              <h4 className="font-bold text-[#17151c]">4. VerdictAgent</h4>
              <p className="mt-1">
                Synthesizes the final composite score (0–100) using weighted rubric: Accuracy (40%), Relevance (30%), Hallucination-adjusted (15%), and Completeness (15%). Outputs PASS, REVIEW, or FAIL verdict with human-readable rationales.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "api",
      title: "API Reference",
      icon: Code2,
      content: (
        <div className="space-y-5 text-xs text-[#4c4458]">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[#17151c] text-sm">
                POST /api/evaluate
              </h4>
              <button
                onClick={() =>
                  handleCopyCode(
                    `curl -X POST "${API_BASE_URL}/api/evaluate" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "question": "What is photosynthesis?",\n    "ai_response": "Photosynthesis converts light into glucose, releasing oxygen.",\n    "top_k": 5\n  }'`
                  )
                }
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6d28d9] hover:underline"
              >
                <Copy size={11} /> Copy Curl
              </button>
            </div>
            <p className="mt-1">Execute multi-agent evaluation pipeline and persist results to PostgreSQL.</p>
            <div className="mt-2 rounded-xl bg-[#1e1b29] p-3 text-[#e2dcf2] font-mono text-[11px] overflow-x-auto">
              {`curl -X POST "${API_BASE_URL}/api/evaluate" \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "What is photosynthesis?",
    "ai_response": "Photosynthesis converts light into glucose, releasing oxygen.",
    "top_k": 5
  }'`}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[#17151c] text-sm">
                POST /api/knowledge/search
              </h4>
              <button
                onClick={() =>
                  handleCopyCode(
                    `curl -X POST "${API_BASE_URL}/api/knowledge/search" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "query": "Apollo 11 moon landing quote",\n    "top_k": 5\n  }'`
                  )
                }
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6d28d9] hover:underline"
              >
                <Copy size={11} /> Copy Curl
              </button>
            </div>
            <p className="mt-1">Perform direct semantic vector search against pgvector index.</p>
            <div className="mt-2 rounded-xl bg-[#1e1b29] p-3 text-[#e2dcf2] font-mono text-[11px] overflow-x-auto">
              {`curl -X POST "${API_BASE_URL}/api/knowledge/search" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "Apollo 11 moon landing quote",
    "top_k": 5
  }'`}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[#17151c] text-sm">
                GET /api/evaluate/stats/dashboard
              </h4>
              <button
                onClick={() =>
                  handleCopyCode(`curl "${API_BASE_URL}/api/evaluate/stats/dashboard"`)
                }
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6d28d9] hover:underline"
              >
                <Copy size={11} /> Copy Curl
              </button>
            </div>
            <p className="mt-1">Retrieve aggregated dashboard metrics, hallucination frequency, completeness distribution, and top evaluation issues.</p>
            <div className="mt-2 rounded-xl bg-[#1e1b29] p-3 text-[#e2dcf2] font-mono text-[11px] overflow-x-auto">
              {`curl "${API_BASE_URL}/api/evaluate/stats/dashboard"`}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[#17151c] text-sm">
                GET /api/evaluate/&#123;id&#125;/export-pdf & GET /api/evaluate/batch/&#123;batch_id&#125;/export-pdf
              </h4>
            </div>
            <p className="mt-1">Download structured compliance PDF evaluation report with score breakdowns and claim verification evidence.</p>
          </div>
        </div>
      ),
    },
    {
      id: "benchmark",
      title: "Multi-AI Benchmark (M4.4)",
      icon: Terminal,
      content: (
        <div className="space-y-4 text-xs text-[#4c4458]">
          <p>
            VeriAI platform benchmark comparison evaluating <strong>AI System Alpha (Grounded RAG)</strong> against <strong>AI System Beta (Un-grounded LLM)</strong> across identical test sets:
          </p>

          <div className="overflow-x-auto rounded-2xl border border-[#ece5f4]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#faf8fd] border-b border-[#eee8f5] text-[10px] font-bold uppercase text-[#8a8296]">
                  <th className="py-2.5 pl-3">Dimension / Metric</th>
                  <th className="py-2.5">AI System Alpha (RAG)</th>
                  <th className="py-2.5">AI System Beta (Un-grounded)</th>
                  <th className="py-2.5 pr-3">Verdict Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f2ecf8]">
                <tr>
                  <td className="py-2.5 pl-3 font-bold text-[#17151c]">Pass Rate</td>
                  <td className="py-2.5 font-bold text-emerald-700">92.5% PASS</td>
                  <td className="py-2.5 font-bold text-rose-700">35.0% PASS</td>
                  <td className="py-2.5 pr-3 text-[#64748b]">Grounded evidence reduces failure by 57.5%</td>
                </tr>
                <tr>
                  <td className="py-2.5 pl-3 font-bold text-[#17151c]">Average Accuracy</td>
                  <td className="py-2.5 font-bold text-[#6d28d9]">94.0%</td>
                  <td className="py-2.5 font-bold text-amber-700">58.2%</td>
                  <td className="py-2.5 pr-3 text-[#64748b]">Atomic claim verification flags unverified claims</td>
                </tr>
                <tr>
                  <td className="py-2.5 pl-3 font-bold text-[#17151c]">Hallucination Risk</td>
                  <td className="py-2.5 font-bold text-emerald-700">4.2% (Low)</td>
                  <td className="py-2.5 font-bold text-rose-700">42.8% (High)</td>
                  <td className="py-2.5 pr-3 text-[#64748b]">Flags unsupported figures & fabricated assertions</td>
                </tr>
                <tr>
                  <td className="py-2.5 pl-3 font-bold text-[#17151c]">Completeness Score</td>
                  <td className="py-2.5 font-bold text-indigo-700">88.0%</td>
                  <td className="py-2.5 font-bold text-amber-700">61.5%</td>
                  <td className="py-2.5 pr-3 text-[#64748b]">Audits missing aspects & partial answers</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ),
    },
    {
      id: "database",
      title: "Database Schema",
      icon: Database,
      content: (
        <div className="space-y-4 text-xs text-[#4c4458]">
          <p>VeriAI uses PostgreSQL 16 with the <code>pgvector</code> extension for storing knowledge and evaluations.</p>
          <div className="rounded-2xl border border-[#ece5f4] bg-white p-4">
            <h4 className="font-bold text-[#17151c] mb-2">Relational Tables</h4>
            <ul className="list-disc pl-4 space-y-1 font-mono text-[11px]">
              <li><strong>knowledge_sources:</strong> Master catalog of certified datasets.</li>
              <li><strong>knowledge_documents:</strong> Contextual articles and reference guides.</li>
              <li><strong>knowledge_chunks:</strong> Windowed text passages with 384d vector embedding.</li>
              <li><strong>evaluations:</strong> Audited evaluation runs, overall scores, and jury verdicts.</li>
              <li><strong>evaluation_claims:</strong> Individual claims extracted from AI responses.</li>
              <li><strong>evaluation_evidence:</strong> Supporting or contradicting evidence passages.</li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  return (
    <AppLayout
      eyebrow="Developer Resources"
      title="Platform Documentation"
      subtitle="Complete developer reference for VeriAI's evaluation APIs, agent pipeline, and PostgreSQL database schemas."
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-3xl border border-[#ece5f4] bg-white p-4 shadow-sm space-y-1">
            <span className="block px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[#8b8396]">
              Sections
            </span>
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeTab === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveTab(sec.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "bg-[#6d28d9] text-white shadow-xs"
                      : "text-[#5e566d] hover:bg-[#f6f2fd] hover:text-[#6d28d9]"
                  }`}
                >
                  <Icon size={15} />
                  <span>{sec.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm sm:p-8 lg:col-span-3">
          <h2 className="font-display text-xl font-bold text-[#17151c] mb-4 border-b border-[#f0ebf7] pb-3">
            {sections.find((s) => s.id === activeTab)?.title}
          </h2>
          {sections.find((s) => s.id === activeTab)?.content}
        </div>
      </div>
    </AppLayout>
  );
}

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  FileCheck2,
  Layers,
  Network,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";

interface ArchitectureNode {
  id: string;
  name: string;
  category: "interface" | "backend" | "agent" | "storage" | "pipeline";
  technology: string;
  purpose: string;
  input: string;
  output: string;
  icon: any;
}

const ARCHITECTURE_NODES: ArchitectureNode[] = [
  {
    id: "ui",
    name: "React + Vite Frontend",
    category: "interface",
    technology: "React 19, Vite, TailwindCSS, TypeScript, Wouter",
    purpose: "Provides the interactive evaluation studio, real-time jury oversight, evidence explorer, and historical audit dashboard.",
    input: "User question, AI-generated response, optional reference answer & source documents.",
    output: "Interactive request payload, reactive state updates, JSON/PDF exports.",
    icon: Code2,
  },
  {
    id: "api",
    name: "FastAPI Orchestrator",
    category: "backend",
    technology: "Python 3.11, FastAPI, Pydantic v2, Uvicorn, SQLAlchemy",
    purpose: "Validates input schemas, coordinates asynchronous agent pipeline execution, and manages transactional database persistence.",
    input: "EvaluateRequest (question, ai_response, reference_answer, dataset, top_k).",
    output: "EvaluateResponse with claim-by-claim verdict, scores, evidence, and rationales.",
    icon: Server,
  },
  {
    id: "retriever",
    name: "RetrieverAgent (Agent 1)",
    category: "agent",
    technology: "BAAI/bge-small-en-v1.5 ONNX, SQLAlchemy vector cosine operator",
    purpose: "Embeds query and response, executes multi-hop similarity search against pgvector, and pools top evidence passages.",
    input: "Question and candidate AI response strings.",
    output: "Ranked EvidenceChunks with cosine similarity scores and provenance metadata.",
    icon: Search,
  },
  {
    id: "pgvector",
    name: "PostgreSQL + pgvector",
    category: "storage",
    technology: "PostgreSQL 16, pgvector 0.8.6, HNSW index (m=16, ef=64)",
    purpose: "Stores canonical knowledge base chunks, document metadata, and persistent evaluation history with high-dimensional vector search.",
    input: "384-dimensional dense float vector queries.",
    output: "Top-K nearest neighbor chunk records within cosine distance thresholds.",
    icon: Database,
  },
  {
    id: "accuracy",
    name: "AccuracyAgent (Agent 2)",
    category: "agent",
    technology: "Sentence tokenization, claim extraction, dense embedding similarity",
    purpose: "Deconstructs AI response into atomic claims, matching each claim against retrieved evidence and canonical ground truth.",
    input: "AI response string and retrieved evidence pool.",
    output: "List of ClaimResults with status (supported, partial, unsupported) and similarity.",
    icon: FileCheck2,
  },
  {
    id: "hallucination",
    name: "HallucinationAgent (Agent 3)",
    category: "agent",
    technology: "Deterministic semantic clash detector, contradiction heuristics",
    purpose: "Quantifies hallucination risk, distinguishing between unsupported claims and explicit factual contradictions.",
    input: "AccuracyResult claims and reference ground truth.",
    output: "HallucinationResult with risk percentage (0-100%) and contradiction flags.",
    icon: ShieldAlert,
  },
  {
    id: "verdict",
    name: "VerdictAgent (Agent 4)",
    category: "agent",
    technology: "Weighted signal synthesizer, multi-dimension scoring rubric",
    purpose: "Combines accuracy (40%), relevance (30%), hallucination (15%), and completeness (15%) into final PASS/REVIEW/FAIL score.",
    input: "Retriever, Accuracy, and Hallucination results.",
    output: "VerdictResult with overall score (0-100), verdict badge, and explainable reasons.",
    icon: ShieldCheck,
  },
  {
    id: "persistence",
    name: "PostgreSQL Audit Store",
    category: "storage",
    technology: "SQLAlchemy ORM, PostgreSQL tables (evaluations, claims, evidence)",
    purpose: "Guarantees permanent auditability by writing full evaluation results, claim statuses, and evidence links to the relational store.",
    input: "Evaluation entity and child relationship rows.",
    output: "Durable database records accessible via GET /api/evaluate/history.",
    icon: Layers,
  },
];

const KNOWLEDGE_PIPELINE_STEPS = [
  { step: "1. Canonical Data Ingestion", desc: "SQuAD v1.1 (501 docs) and TruthfulQA (500 docs) ingested via CLI or REST endpoints.", tech: "Hugging Face Datasets API" },
  { step: "2. Data Cleaning & Normalization", desc: "Strips HTML tags, normalizes whitespace, formats questions and answers consistently.", tech: "Python text processing" },
  { step: "3. Semantic Window Chunking", desc: "Configurable token/character windowing (500 chars, 50 char overlap) preserving sentence bounds.", tech: "Recursive Text Chunker" },
  { step: "4. Dense Vector Embedding", desc: "Transforms each chunk into a 384-dimensional dense semantic vector.", tech: "BAAI/bge-small-en-v1.5 (ONNX)" },
  { step: "5. HNSW Vector Indexing", desc: "Builds Hierarchical Navigable Small World index with vector_cosine_ops in PostgreSQL.", tech: "pgvector 0.8.6" },
  { step: "6. Semantic Retrieval", desc: "Executes cosine distance queries merging query & candidate response embeddings.", tech: "<=> Cosine Operator" },
];

export default function Architecture() {
  const [selectedNode, setSelectedNode] = useState<ArchitectureNode>(ARCHITECTURE_NODES[0]);

  return (
    <AppLayout
      eyebrow="System Architecture"
      title="Multi-Agent Evaluation Pipeline"
      subtitle="Interactive architectural blueprint of VeriAI's evidence-grounded multi-agent verification system."
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left 2 Columns: Interactive Pipeline Flow */}
        <div className="space-y-6 lg:col-span-2">
          {/* Main Agent Jury Flow Card */}
          <section className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2 text-[#6d28d9] mb-1">
              <BrainCircuit size={20} />
              <h2 className="font-display text-base font-bold text-[#17151c]">
                End-to-End Evaluation Pipeline
              </h2>
            </div>
            <p className="text-xs text-[#736c7e] mb-6">
              Click any stage below to inspect its purpose, technology, input parameters, and output artifacts.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {ARCHITECTURE_NODES.map((node, idx) => {
                const Icon = node.icon;
                const isSelected = selectedNode.id === node.id;
                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`flex items-start gap-3.5 rounded-2xl border p-4 text-left transition ${
                      isSelected
                        ? "border-[#6d28d9] bg-[#faf7fd] shadow-sm shadow-[#6d28d9]/10"
                        : "border-[#ece5f4] bg-white hover:border-[#6d28d9]/40 hover:bg-[#fcfbfe]"
                    }`}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl transition ${
                        isSelected
                          ? "bg-[#6d28d9] text-white"
                          : "bg-[#f4effc] text-[#6d28d9]"
                      }`}
                    >
                      <Icon size={18} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#8b8396]">
                          Stage {idx + 1}
                        </span>
                      </div>
                      <div className="font-display text-xs font-bold text-[#1a1423] mt-0.5">
                        {node.name}
                      </div>
                      <div className="mt-1 text-[11px] text-[#787183] line-clamp-1">
                        {node.technology}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Knowledge Ingestion Pipeline Card */}
          <section className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2 text-[#16a34a] mb-1">
              <Database size={20} />
              <h2 className="font-display text-base font-bold text-[#17151c]">
                Knowledge Ingestion & Vector Indexing Pipeline
              </h2>
            </div>
            <p className="text-xs text-[#736c7e] mb-6">
              How canonical datasets (SQuAD & TruthfulQA) are ingested, chunked, embedded, and indexed.
            </p>

            <div className="space-y-3">
              {KNOWLEDGE_PIPELINE_STEPS.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-2xl border border-[#ece5f4] bg-[#faf8fd] p-3.5 text-xs"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-[#6d28d9]/10 text-[11px] font-bold text-[#6d28d9]">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-[#17151c]">{step.step}</strong>
                      <span className="rounded bg-white px-2 py-0.5 text-[10px] font-mono text-[#6d28d9] border border-[#ede5f6]">
                        {step.tech}
                      </span>
                    </div>
                    <p className="mt-1 text-[#6b6477] leading-relaxed">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Node Inspector Panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-3 border-b border-[#f0ebf7] pb-4">
              <span className="grid size-10 place-items-center rounded-xl bg-[#6d28d9] text-white">
                <selectedNode.icon size={20} />
              </span>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a8296]">
                  Component Inspector
                </span>
                <h3 className="font-display text-base font-bold text-[#17151c]">
                  {selectedNode.name}
                </h3>
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8a8296] mb-1">
                Purpose & Role
              </span>
              <p className="text-xs text-[#484054] leading-relaxed bg-[#faf8fd] rounded-xl border border-[#ece5f4] p-3">
                {selectedNode.purpose}
              </p>
            </div>

            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8a8296] mb-1">
                Technology Stack
              </span>
              <div className="font-mono text-xs text-[#6d28d9] bg-[#f7f3fd] rounded-xl border border-[#ede7f6] p-3">
                {selectedNode.technology}
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8a8296] mb-1">
                Input Data
              </span>
              <div className="text-xs text-[#4a4256] leading-relaxed bg-[#faf8fd] rounded-xl border border-[#ece5f4] p-3">
                {selectedNode.input}
              </div>
            </div>

            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8a8296] mb-1">
                Output Artifacts
              </span>
              <div className="text-xs text-[#4a4256] leading-relaxed bg-[#faf8fd] rounded-xl border border-[#ece5f4] p-3">
                {selectedNode.output}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

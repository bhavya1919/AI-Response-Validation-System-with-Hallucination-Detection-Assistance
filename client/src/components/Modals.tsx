import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BookOpenCheck,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Key,
  Lock,
  LogIn,
  LogOut,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  User,
} from "lucide-react";
import { useEvaluation } from "@/contexts/EvaluationContext";

// ==========================================
// 1. Sign In / User Account Modal
// ==========================================
export function SignInModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { userProfile, loginUser, logoutUser } = useEvaluation();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your work email");
      return;
    }
    loginUser(email);
    toast.success(
      isRegister
        ? "Account created and signed in successfully!"
        : "Signed in successfully!"
    );
    onOpenChange(false);
  };

  const handleDemoSignIn = () => {
    loginUser("alex.morgan@evalai.org", "Alex Morgan");
    toast.success("Signed in as Demo User: Alex Morgan");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] rounded-3xl p-6 bg-white border-[#e8e2f0] shadow-2xl">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-2 text-[#6d28d9]">
            <span className="grid size-8 place-items-center rounded-xl bg-[#f2ecfc]">
              <ShieldCheck size={18} />
            </span>
            <span className="font-display text-sm font-bold tracking-tight text-[#17151c]">
              Veri<span className="text-[#6d28d9]">AI</span> Workspace
            </span>
          </div>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-[#17151c]">
            {userProfile.isLoggedIn
              ? "Account Settings"
              : isRegister
              ? "Create your account"
              : "Sign in to VeriAI"}
          </DialogTitle>
          <DialogDescription className="text-xs text-[#736c7e]">
            {userProfile.isLoggedIn
              ? "Manage your active evaluation session and API quotas."
              : isRegister
              ? "Get instant access to automated evidence retrieval & judge pipelines."
              : "Access your saved evaluations, API keys, and custom benchmarks."}
          </DialogDescription>
        </DialogHeader>

        {userProfile.isLoggedIn ? (
          <div className="space-y-4 pt-2">
            <div className="rounded-2xl border border-[#eee7f6] bg-[#faf8fd] p-4">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-full bg-[#6d28d9] text-white font-display font-bold text-base shadow-md">
                  {userProfile.name.charAt(0)}
                </div>
                <div>
                  <div className="font-display font-semibold text-sm text-[#1b1722]">
                    {userProfile.name}
                  </div>
                  <div className="text-xs text-[#7c7586]">{userProfile.email}</div>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-[#e9f8ed] px-2 py-0.5 text-[10px] font-bold text-[#16803b]">
                    <CheckCircle2 size={11} /> {userProfile.tier}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-2 text-xs">
              <div className="flex items-center justify-between rounded-xl border border-[#e8e3ee] p-3 text-[#585162]">
                <span>Evaluations Run Today</span>
                <strong className="font-display text-[#17151c]">14 / 200</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#e8e3ee] p-3 text-[#585162]">
                <span>Active API Keys</span>
                <strong className="font-display text-[#17151c]">2 Production</strong>
              </div>
            </div>

            <button
              onClick={() => {
                logoutUser();
                toast.info("Signed out successfully");
                onOpenChange(false);
              }}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50/70 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-100"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#797282] mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9991a3]"
                  />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#ded7e8] bg-[#fbfafc] py-2.5 pl-10 pr-3 text-xs text-[#2b2533] outline-none transition focus:border-[#6d28d9] focus:bg-white focus:ring-2 focus:ring-[#6d28d9]/10"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#797282] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9991a3]"
                  />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-[#ded7e8] bg-[#fbfafc] py-2.5 pl-10 pr-3 text-xs text-[#2b2533] outline-none transition focus:border-[#6d28d9] focus:bg-white focus:ring-2 focus:ring-[#6d28d9]/10"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6d28d9] py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#5b21b6] active:scale-[0.98]"
              >
                <LogIn size={14} /> {isRegister ? "Create Account" : "Sign In"}
              </button>
            </form>

            <div className="relative flex items-center justify-center">
              <span className="absolute inset-x-0 border-t border-[#eee9f4]" />
              <span className="relative bg-white px-3 text-[10px] font-bold uppercase tracking-widest text-[#9c94a5]">
                or explore quickly
              </span>
            </div>

            <button
              onClick={handleDemoSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d6cbe9] bg-[#f7f3ff] py-2.5 text-xs font-bold text-[#6d28d9] transition hover:bg-[#eee7ff]"
            >
              <Sparkles size={14} /> Continue with Demo Account (Instant)
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-xs font-semibold text-[#7e778a] hover:text-[#6d28d9]"
              >
                {isRegister
                  ? "Already have an account? Sign in"
                  : "Need a new account? Register here"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 2. Evidence Explorer Modal
// ==========================================
export function EvidenceModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const evidenceItems = [
    {
      id: "ev-01",
      corpus: "SQuAD 2.0 Biology",
      relevance: 98,
      title: "Cellular Energy & Chloroplast Mechanism",
      snippet:
        "Photosynthesis takes place in chloroplasts containing chlorophyll pigments. Light energy converts water and carbon dioxide into chemical energy stored as glucose, releasing oxygen gas as an essential byproduct.",
      doi: "10.1016/j.cell.2023.01.04",
      claimsMatched: ["Plant process", "Chemical energy conversion"],
    },
    {
      id: "ev-02",
      corpus: "TruthfulQA Benchmark",
      relevance: 94,
      title: "Photosynthetic Pigment Absorption Spectra",
      snippet:
        "Chlorophyll a and b absorb light wavelengths primarily in the blue (430-450 nm) and red (640-660 nm) spectrums while reflecting green wavelengths, generating ATP via the thylakoid proton gradient.",
      doi: "10.1126/science.1142981",
      claimsMatched: ["Chlorophyll absorption"],
    },
    {
      id: "ev-03",
      corpus: "PubMed Central BioRef",
      relevance: 89,
      title: "Dark Reactions & Calvin Cycle",
      snippet:
        "The Calvin-Benson-Bassham cycle fixes atmospheric carbon dioxide through the ribulose-1,5-bisphosphate carboxylase/oxygenase (RuBisCO) enzyme, synthesising glyceraldehyde-3-phosphate.",
      doi: "10.1038/nchembio.2019.88",
      claimsMatched: ["Carbon dioxide fixation"],
    },
    {
      id: "ev-04",
      corpus: "Custom Knowledge Base",
      relevance: 82,
      title: "Plant Metabolic Regulation",
      snippet:
        "Stomatal conductance regulates gaseous exchange, balancing CO2 intake for sugar synthesis against transpirational water deficit in terrestrial C3 and C4 plants.",
      doi: "internal-doc:KB-PLANT-092",
      claimsMatched: ["Water consumption"],
    },
  ];

  const filtered = evidenceItems.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.snippet.toLowerCase().includes(search.toLowerCase()) ||
      item.corpus.toLowerCase().includes(search.toLowerCase());
    if (activeFilter === "all") return matchesSearch;
    if (activeFilter === "squad")
      return matchesSearch && item.corpus.includes("SQuAD");
    if (activeFilter === "truthfulqa")
      return matchesSearch && item.corpus.includes("TruthfulQA");
    if (activeFilter === "pubmed")
      return matchesSearch && item.corpus.includes("PubMed");
    return matchesSearch;
  });

  const handleCopy = (snippet: string) => {
    navigator.clipboard.writeText(snippet);
    toast.success("Evidence citation copied to clipboard!");
  };

  const handleExport = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(evidenceItems, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "veriai-evidence-corpus.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Exported 4 evidence passages as JSON");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto rounded-3xl p-6 bg-white border-[#e8e2f0] shadow-2xl">
        <DialogHeader className="text-left space-y-2 border-b border-[#eee9f4] pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-[#f2ecfc] text-[#6d28d9]">
                <Search size={16} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#6d28d9]">
                Evidence Browser
              </span>
            </div>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#ded5ec] px-3 py-1.5 text-xs font-semibold text-[#544d5e] hover:bg-[#faf7fd] hover:text-[#6d28d9]"
            >
              <Download size={13} /> Export JSON
            </button>
          </div>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-[#17151c]">
            Retrieved Reference Evidence
          </DialogTitle>
          <DialogDescription className="text-xs text-[#736c7e]">
            Inspect all passages retrieved from vector indexes that were used by the judge agents to corroborate factual claims.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Search bar & filter pills */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9f98a8]"
              />
              <input
                type="text"
                placeholder="Search retrieved passages or topics..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[#e2dbe9] bg-[#fbfafc] py-2 pl-9 pr-3 text-xs text-[#2b2533] outline-none focus:border-[#6d28d9]"
              />
            </div>
            <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-semibold">
              {[
                { id: "all", label: "All Sources" },
                { id: "squad", label: "SQuAD 2.0" },
                { id: "truthfulqa", label: "TruthfulQA" },
                { id: "pubmed", label: "PubMed" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`rounded-full px-2.5 py-1 transition ${
                    activeFilter === tab.id
                      ? "bg-[#6d28d9] text-white"
                      : "bg-[#f3f0f7] text-[#6d6676] hover:bg-[#e9e3f1]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Passage Cards */}
          <div className="space-y-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-[#e8e2ef] bg-[#fcfbfe] p-4 transition hover:border-[#cbb9e6] hover:bg-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block rounded-md bg-[#eee7ff] px-2 py-0.5 text-[10px] font-bold text-[#6d28d9]">
                      {item.corpus}
                    </span>
                    <h4 className="mt-1 font-display text-sm font-semibold text-[#1e1927]">
                      {item.title}
                    </h4>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] uppercase font-bold text-[#8f8899]">
                      Relevance
                    </div>
                    <div className="font-display font-bold text-sm text-[#16a34a]">
                      {item.relevance}%
                    </div>
                  </div>
                </div>

                <p className="mt-2.5 rounded-xl border border-[#eee8f5] bg-white p-3 text-xs leading-relaxed text-[#4e4757]">
                  "{item.snippet}"
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#7d7687]">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#484252]">Matched claims:</span>
                    {item.claimsMatched.map((c) => (
                      <span
                        key={c}
                        className="rounded-md border border-[#e1d9eb] bg-[#f8f5fd] px-2 py-0.5 text-[10px] text-[#6d28d9]"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => handleCopy(item.snippet)}
                    className="inline-flex items-center gap-1 text-[#6d28d9] font-bold hover:underline"
                  >
                    <Copy size={12} /> Copy Citation
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 3. Knowledge Base Modal
// ==========================================
export function KnowledgeBaseModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [stats, setStats] = useState<{
    sources: number;
    documents: number;
    chunks: number;
    chunks_with_embeddings: number;
    datasets?: Record<string, { documents: number; chunks: number }>;
  }>({
    sources: 3,
    documents: 1001,
    chunks: 1937,
    chunks_with_embeddings: 1937,
    datasets: {
      squad: { documents: 500, chunks: 1421 },
      truthfulqa: { documents: 500, chunks: 515 },
      "core-architecture": { documents: 1, chunks: 1 }
    }
  });

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("http://localhost:8000/api/knowledge/ingest/stats")
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.sources === "number") {
            setStats(data);
          }
        })
        .catch(() => {
          // Keep current fallback stats if backend is unreachable
        });
    }
  }, [open]);

  const handleSimulatedUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setStats((prev) => ({
        ...prev,
        documents: prev.documents + 1,
        chunks: prev.chunks + 2,
        chunks_with_embeddings: prev.chunks_with_embeddings + 2
      }));
      setIsUploading(false);
      toast.success("Document chunked, embedded with BGE-384, and indexed in pgvector!");
    }, 1200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[660px] max-h-[85vh] overflow-y-auto rounded-3xl p-6 bg-white border-[#e8e2f0] shadow-2xl">
        <DialogHeader className="text-left space-y-2 border-b border-[#eee9f4] pb-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-[#f2ecfc] text-[#6d28d9]">
              <Database size={16} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#6d28d9]">
              Reference Knowledge Base & Vector Stores
            </span>
          </div>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-[#17151c]">
            Curated Knowledge & Vector Stores
          </DialogTitle>
          <DialogDescription className="text-xs text-[#736c7e]">
            VeriAI connects to canonical benchmarks and custom corpuses indexed via PostgreSQL pgvector with BAAI/bge-small-en-v1.5 embeddings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Live Stats Overview */}
          <div className="grid grid-cols-4 gap-2.5">
            <div className="rounded-2xl border border-[#ece6f5] bg-[#faf8fe] p-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#797186]">Sources</span>
              <p className="font-display text-xl font-bold text-[#6d28d9] mt-0.5">{stats.sources}</p>
            </div>
            <div className="rounded-2xl border border-[#ece6f5] bg-[#faf8fe] p-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#797186]">Documents</span>
              <p className="font-display text-xl font-bold text-[#1f1929] mt-0.5">{stats.documents.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-[#ece6f5] bg-[#faf8fe] p-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#797186]">Total Chunks</span>
              <p className="font-display text-xl font-bold text-[#1f1929] mt-0.5">{stats.chunks.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-[#d9f2de] bg-[#f2faf4] p-3 text-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#1e783a]">Embedded</span>
              <p className="font-display text-xl font-bold text-[#16803b] mt-0.5">{stats.chunks_with_embeddings.toLocaleString()}</p>
            </div>
          </div>

          {/* Upload Simulation Area */}
          <div
            onClick={handleSimulatedUpload}
            className="group cursor-pointer rounded-2xl border-2 border-dashed border-[#cbb9e6] bg-[#faf8fd] p-5 text-center transition hover:border-[#6d28d9] hover:bg-[#f5efff]"
          >
            <UploadCloud
              size={28}
              className="mx-auto text-[#6d28d9] transition-transform group-hover:scale-110"
            />
            <h4 className="mt-1.5 font-display text-sm font-semibold text-[#1e1927]">
              {isUploading ? "Chunking & Embedding with pgvector..." : "Upload Custom Reference Material"}
            </h4>
            <p className="mt-0.5 text-xs text-[#7f788b]">
              Add custom ground-truth PDFs, Markdown, or JSONL to ground evaluation agents.
            </p>
            <span className="mt-2.5 inline-block rounded-full bg-[#6d28d9] px-3.5 py-1 text-[11px] font-bold text-white shadow-sm">
              {isUploading ? "Vectorizing..." : "Select Document to Index"}
            </span>
          </div>

          {/* Active Repositories / Benchmarks */}
          <div>
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-[#827b8c] mb-2">
              Active Grounding Benchmarks (PostgreSQL pgvector)
            </h5>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl border border-[#e8e2ef] bg-white p-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <FileText size={16} className="text-[#6d28d9]" />
                  <div>
                    <span className="font-semibold text-[#2f2939]">SQuAD v1.1 Reading Comprehension</span>
                    <p className="text-[11px] text-[#787182]">
                      Dataset: squad • {stats.datasets?.squad?.documents ?? 500} docs • {stats.datasets?.squad?.chunks ?? 1421} chunks
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f8ed] px-2.5 py-1 text-[10px] font-bold text-[#16803b]">
                  <Check size={11} /> 384-dim BGE indexed
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#e8e2ef] bg-white p-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <FileText size={16} className="text-[#6d28d9]" />
                  <div>
                    <span className="font-semibold text-[#2f2939]">TruthfulQA Factuality & Hallucination Benchmark</span>
                    <p className="text-[11px] text-[#787182]">
                      Dataset: truthfulqa • {stats.datasets?.truthfulqa?.documents ?? 500} docs • {stats.datasets?.truthfulqa?.chunks ?? 515} chunks
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f8ed] px-2.5 py-1 text-[10px] font-bold text-[#16803b]">
                  <Check size={11} /> 384-dim BGE indexed
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#e8e2ef] bg-white p-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <FileText size={16} className="text-[#6d28d9]" />
                  <div>
                    <span className="font-semibold text-[#2f2939]">VeriAI Docs Architecture Guide</span>
                    <p className="text-[11px] text-[#787182]">
                      Dataset: core-architecture • {stats.datasets?.["core-architecture"]?.documents ?? 1} doc • {stats.datasets?.["core-architecture"]?.chunks ?? 1} chunk
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f8ed] px-2.5 py-1 text-[10px] font-bold text-[#16803b]">
                  <Check size={11} /> 384-dim BGE indexed
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 4. API & Documentation Modal
// ==========================================
export function DocumentationModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const curlSnippet = `curl -X POST https://api.veriai.org/v1/evaluate \\
  -H "Authorization: Bearer veriai_live_k928f01" \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "What is photosynthesis?",
    "ai_response": "Plants convert light energy into glucose.",
    "ground_truth": "Plants convert light energy into chemical energy.",
    "evaluation_dimensions": ["relevance", "accuracy", "hallucination", "completeness"]
  }'`;

  const pythonSnippet = `from veriai import VeriEvaluator

client = VeriEvaluator(api_key="veriai_live_k928f01")

verdict = client.evaluate(
    question="What is photosynthesis?",
    ai_response="Plants convert light energy into glucose.",
    benchmark="squad_biology_v2"
)

print(f"Verdict: {verdict.status} (Score: {verdict.score}/100)")
print(f"Hallucination Risk: {verdict.hallucination_percentage}%")`;

  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedPy, setCopiedPy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] overflow-y-auto rounded-3xl p-6 bg-white border-[#e8e2f0] shadow-2xl">
        <DialogHeader className="text-left space-y-2 border-b border-[#eee9f4] pb-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-[#f2ecfc] text-[#6d28d9]">
              <BookOpenCheck size={16} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#6d28d9]">
              Developer Documentation
            </span>
          </div>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-[#17151c]">
            VeriAI FastAPI & Python SDK
          </DialogTitle>
          <DialogDescription className="text-xs text-[#736c7e]">
            Trigger automated multi-agent AI verification in your CI/CD test suites or production inference middleware.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#797283]">
                cURL / REST API
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(curlSnippet);
                  setCopiedCurl(true);
                  toast.success("cURL snippet copied!");
                  setTimeout(() => setCopiedCurl(false), 2000);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6d28d9] hover:underline"
              >
                {copiedCurl ? <Check size={12} /> : <Copy size={12} />}
                {copiedCurl ? "Copied" : "Copy cURL"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-2xl bg-[#18131f] p-4 text-[11px] font-mono leading-relaxed text-violet-100">
              {curlSnippet}
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#797283]">
                Python SDK Integration
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pythonSnippet);
                  setCopiedPy(true);
                  toast.success("Python code copied!");
                  setTimeout(() => setCopiedPy(false), 2000);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6d28d9] hover:underline"
              >
                {copiedPy ? <Check size={12} /> : <Copy size={12} />}
                {copiedPy ? "Copied" : "Copy Python"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-2xl bg-[#18131f] p-4 text-[11px] font-mono leading-relaxed text-violet-100">
              {pythonSnippet}
            </pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 5. Contact & Support Modal
// ==========================================
export function ContactModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Thank you! Your inquiry has been routed to the VeriAI engineering team.");
    onOpenChange(false);
    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-3xl p-6 bg-white border-[#e8e2f0] shadow-2xl">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-xl bg-[#f2ecfc] text-[#6d28d9]">
              <Mail size={16} />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#6d28d9]">
              Contact VeriAI Team
            </span>
          </div>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-[#17151c]">
            Get in touch
          </DialogTitle>
          <DialogDescription className="text-xs text-[#736c7e]">
            Have questions about custom knowledge bases, enterprise on-premise deployments, or custom judge weights?
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-2">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#797282] mb-1">
              Your Name
            </label>
            <input
              type="text"
              required
              placeholder="Dr. Elena Vance"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-[#ded7e8] bg-[#fbfafc] py-2.5 px-3 text-xs text-[#2b2533] outline-none focus:border-[#6d28d9]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#797282] mb-1">
              Work Email
            </label>
            <input
              type="email"
              required
              placeholder="elena@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#ded7e8] bg-[#fbfafc] py-2.5 px-3 text-xs text-[#2b2533] outline-none focus:border-[#6d28d9]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#797282] mb-1">
              Message / Inquiries
            </label>
            <textarea
              required
              rows={3}
              placeholder="We would like to evaluate our internal RAG pipeline for medical QA..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-[#ded7e8] bg-[#fbfafc] py-2.5 px-3 text-xs text-[#2b2533] outline-none focus:border-[#6d28d9]"
            />
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#6d28d9] py-3 text-xs font-bold text-white shadow-md transition hover:bg-[#5b21b6]"
          >
            Send Inquiry
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 6. Generic Clean Information Modal (About, Privacy, Terms)
// ==========================================
export function InfoModal({
  open,
  onOpenChange,
  title,
  eyebrow,
  content,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  eyebrow: string;
  content: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto rounded-3xl p-6 bg-white border-[#e8e2f0] shadow-2xl">
        <DialogHeader className="text-left space-y-2 border-b border-[#eee9f4] pb-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#6d28d9]">
              {eyebrow}
            </span>
          </div>
          <DialogTitle className="font-display text-2xl font-semibold tracking-tight text-[#17151c]">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2 text-xs leading-relaxed text-[#5a5364]">
          {content.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
          <button
            onClick={() => onOpenChange(false)}
            className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#f0eaff] py-2.5 text-xs font-bold text-[#6d28d9] hover:bg-[#e4d8fb]"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

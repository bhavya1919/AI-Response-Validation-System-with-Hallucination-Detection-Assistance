import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  BellRing,
  Bot,
  Boxes,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  Database,
  Eye,
  FileCheck2,
  FileText,
  Gauge,
  GitBranch,
  Layers,
  LockKeyhole,
  Menu,
  Network,
  PanelTop,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import {
  SignInModal,
  EvidenceModal,
  KnowledgeBaseModal,
  DocumentationModal,
  ContactModal,
  InfoModal,
} from "@/components/Modals";
import { useEvaluation, PRESET_EVALUATIONS } from "@/contexts/EvaluationContext";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Evaluation", href: "#evaluation" },
  { label: "Architecture", href: "/architecture" },
  { label: "Use cases", href: "#use-cases" },
];

const workflowSteps = [
  { number: "01", title: "Input", detail: "Question + AI response", icon: FileText },
  { number: "02", title: "Retrieve", detail: "Relevant trusted evidence", icon: Search },
  { number: "03", title: "Evaluate", detail: "Multiple evaluation agents", icon: Gauge },
  { number: "04", title: "Verify", detail: "Claims against evidence", icon: BadgeCheck },
  { number: "05", title: "Decide", detail: "Final score + verdict", icon: CheckCircle2 },
  { number: "06", title: "Explain", detail: "Evidence-backed report", icon: PanelTop },
];

const dimensions = [
  {
    index: "01",
    label: "Relevance",
    question: "Did the AI answer what was actually asked?",
    score: "96",
    suffix: "/ 100",
    description: "Measures how directly and appropriately the response addresses the user's question.",
    icon: TargetIcon,
    tone: "violet",
  },
  {
    index: "02",
    label: "Accuracy",
    question: "Are the factual claims correct?",
    score: "94",
    suffix: "/ 100",
    description: "Evaluates factual correctness using reference answers and retrieved evidence.",
    icon: CheckCircle2,
    tone: "green",
  },
  {
    index: "03",
    label: "Hallucination risk",
    question: "Which claims are unsupported?",
    score: "6%",
    suffix: "low risk",
    description: "Identifies claims that are unsupported or insufficiently supported by available evidence.",
    icon: AlertTriangle,
    tone: "amber",
  },
  {
    index: "04",
    label: "Completeness",
    question: "Did the response provide the important information?",
    score: "86",
    suffix: "/ 100",
    description: "Measures whether the response sufficiently covers the information required by the question.",
    icon: Layers,
    tone: "blue",
  },
];

const useCases = [
  ["AI application developers", "Validate responses before exposing them to users.", Bot],
  ["RAG application teams", "Measure whether generated responses remain grounded in retrieved evidence.", Database],
  ["Researchers", "Experiment with automated AI evaluation and hallucination detection.", BrainCircuit],
  ["QA & evaluation teams", "Run repeatable evaluations and track response quality over time.", BarChart3],
] as const;

function TargetIcon({ className }: { className?: string }) {
  return <ScanSearch className={className} />;
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="VeriAI home">
      <span className="relative grid size-9 place-items-center rounded-xl bg-[#6d28d9] text-white shadow-[0_8px_20px_rgba(109,40,217,0.25)]">
        <ShieldCheck size={20} strokeWidth={2.15} />
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border-2 border-white bg-[#c4b5fd]" />
      </span>
      {!compact && (
        <span className="font-display text-[1.12rem] font-bold tracking-[-0.04em] text-[#17151c]">
          Veri<span className="text-[#6d28d9]">AI</span>
        </span>
      )}
    </span>
  );
}

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <div
      className={`mb-5 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] ${
        light ? "text-violet-200" : "text-[#6d28d9]"
      }`}
    >
      <span className={`h-px w-7 ${light ? "bg-violet-300/70" : "bg-[#6d28d9]/60"}`} />
      {children}
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  light = false,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  light?: boolean;
}) {
  return (
    <div className={`${align === "center" ? "mx-auto text-center" : ""} max-w-3xl`}>
      <Eyebrow light={light}>{eyebrow}</Eyebrow>
      <h2
        className={`font-display text-4xl font-semibold leading-[1.04] tracking-[-0.055em] sm:text-5xl ${
          light ? "text-white" : "text-[#17151c]"
        }`}
      >
        {title}
      </h2>
      {description && (
        <p
          className={`mt-5 max-w-2xl text-base leading-7 ${
            align === "center" ? "mx-auto" : ""
          } ${light ? "text-violet-100/75" : "text-[#65616e]"}`}
        >
          {description}
        </p>
      )}
    </div>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    violet: "bg-[#7c3aed]",
    green: "bg-[#16a34a]",
    amber: "bg-[#d97706]",
    blue: "bg-[#2563eb]",
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-semibold text-[#6b6872]">
        <span>{label}</span>
        <span className="font-display text-xs text-[#28252e]">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#ece9f1]">
        <div
          className={`metric-fill h-full rounded-full ${colors[color] ?? colors.violet}`}
          style={{ "--metric-width": `${value}%` } as CSSProperties}
        />
      </div>
    </div>
  );
}

function ScoreDonut({ score = 91 }: { score?: number }) {
  const deg = Math.round((score / 100) * 360);
  return (
    <div
      className="relative grid size-[112px] place-items-center rounded-full transition-all duration-500"
      style={{
        background: `conic-gradient(#6d28d9 0deg ${deg}deg, #ede9fe ${deg}deg 360deg)`,
      }}
    >
      <div className="grid size-[91px] place-items-center rounded-full bg-white shadow-inner">
        <div className="text-center">
          <div className="font-display text-[31px] font-semibold leading-none tracking-[-0.07em] text-[#17151c]">
            {score}
          </div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a8692]">
            overall
          </div>
        </div>
      </div>
    </div>
  );
}

function EvaluationMockup() {
  const [activeScenario, setActiveScenario] = useState<"photosynthesis" | "penicillin" | "finance">("photosynthesis");
  const data = PRESET_EVALUATIONS[activeScenario];

  return (
    <div className="relative mx-auto w-full max-w-[580px] animate-float-slow">
      <div className="absolute -inset-8 rounded-[42px] bg-[radial-gradient(circle_at_50%_40%,rgba(124,58,237,0.17),transparent_68%)] blur-2xl" />
      <div className="relative overflow-hidden rounded-[26px] border border-[#ded8e9] bg-white shadow-[0_28px_80px_rgba(37,22,69,0.16)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#ece8f1] bg-[#fcfbfd] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Logo compact />
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#817b8d]">
              Interactive Simulation
            </span>
          </div>

          {/* Scenario toggle buttons */}
          <div className="flex items-center gap-1">
            {[
              { id: "photosynthesis", label: "Biology" },
              { id: "penicillin", label: "History" },
              { id: "finance", label: "Finance" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveScenario(tab.id as any)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-bold transition ${
                  activeScenario === tab.id
                    ? "bg-[#6d28d9] text-white"
                    : "bg-[#f2edfa] text-[#635c6e] hover:bg-[#e7def4]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-3">
              <div className="label-kicker">Question</div>
              <div className="rounded-xl border border-[#ebe7f1] bg-[#fbfafc] p-3 text-[12px] font-medium leading-5 text-[#34303d]">
                {data.question}
              </div>
              <div className="label-kicker pt-1">AI response</div>
              <div className="rounded-xl border border-[#ebe7f1] bg-[#fbfafc] p-3 text-[11px] leading-[1.6] text-[#65616e] line-clamp-3">
                {data.aiResponse}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl bg-[#f7f3ff] p-4 text-center">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7c5ab6]">
                Overall score
              </div>
              <ScoreDonut score={data.overallScore} />
              <div
                className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  data.verdict === "PASS"
                    ? "bg-[#e9f8ed] text-[#16803b]"
                    : data.verdict === "REVIEW"
                    ? "bg-[#fff3dc] text-[#b45309]"
                    : "bg-red-100 text-red-700"
                }`}
              >
                <Check size={12} strokeWidth={2.5} /> {data.verdict} · {data.confidence}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-[#ebe7f1] p-4 sm:grid-cols-2">
            <MetricBar label="Relevance" value={data.scores.relevance} color="violet" />
            <MetricBar label="Accuracy" value={data.scores.accuracy} color="green" />
            <MetricBar label="Hallucination Risk" value={data.scores.hallucinationRisk} color="amber" />
            <MetricBar label="Completeness" value={data.scores.completeness} color="blue" />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_0.88fr]">
            <div className="rounded-2xl border border-[#ebe7f1] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="label-kicker">Evidence support</div>
                <span className="text-[10px] font-semibold text-[#918b9c]">
                  {data.claims.length} claims verified
                </span>
              </div>
              <div className="space-y-2 text-[11px] font-medium">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#3e3946]">
                    <CheckCircle2 size={14} className="text-[#16a34a]" /> Supported claims
                  </span>
                  <strong className="font-display text-[#17151c]">
                    {data.claims.filter((c) => c.status === "supported").length}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#3e3946]">
                    <BellRing size={14} className="text-[#d97706]" /> Partial claims
                  </span>
                  <strong className="font-display text-[#17151c]">
                    {data.claims.filter((c) => c.status === "partial").length}
                  </strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[#3e3946]">
                    <X size={14} className="text-[#dc2626]" /> Unsupported
                  </span>
                  <strong className="font-display text-[#17151c]">
                    {data.claims.filter((c) => c.status === "unsupported").length}
                  </strong>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#18131f] p-4 text-white">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200/70">
                  Verdict
                </div>
                <ShieldCheck size={17} className="text-violet-300" />
              </div>
              <div className="font-display text-xl font-semibold tracking-[-0.04em]">
                {data.verdict}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-violet-100/65 line-clamp-2">
                {data.reasons[0]?.text || "Evaluated by multi-agent jury against pgvector corpus."}
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-[#a7f3b7]">
                <Check size={13} /> evidence-backed verdict
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-4 -left-5 hidden items-center gap-2 rounded-2xl border border-[#e5def4] bg-white px-3.5 py-3 shadow-[0_16px_34px_rgba(44,23,74,0.12)] sm:flex">
        <span className="grid size-7 place-items-center rounded-lg bg-[#f1eaff] text-[#6d28d9]">
          <Search size={14} />
        </span>
        <div>
          <div className="text-[10px] font-bold text-[#312a3b]">Evidence found</div>
          <div className="text-[10px] text-[#8a8493]">pgvector cosine match</div>
        </div>
      </div>

      <div className="absolute -right-3 top-16 hidden items-center gap-2 rounded-2xl border border-[#e5def4] bg-white px-3.5 py-3 shadow-[0_16px_34px_rgba(44,23,74,0.12)] lg:flex">
        <span className="grid size-7 place-items-center rounded-lg bg-[#e9f8ed] text-[#16803b]">
          <CheckCircle2 size={14} />
        </span>
        <div>
          <div className="text-[10px] font-bold text-[#312a3b]">Multi-agent consensus</div>
          <div className="text-[10px] text-[#8a8493]">4 judge agents synced</div>
        </div>
      </div>
    </div>
  );
}

function ArrowConnector() {
  return (
    <div className="hidden shrink-0 items-center text-[#c7b9e3] lg:flex">
      <ArrowRight size={18} />
    </div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { userProfile } = useEvaluation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Modals state
  const [signInOpen, setSignInOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [infoModal, setInfoModal] = useState<{
    open: boolean;
    title: string;
    eyebrow: string;
    content: string[];
  }>({
    open: false,
    title: "",
    eyebrow: "",
    content: [],
  });

  const openInfo = (title: string, eyebrow: string, content: string[]) => {
    setInfoModal({ open: true, title, eyebrow, content });
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (path: string) => {
    setMobileOpen(false);
    if (path.startsWith("/")) setLocation(path);
    else document.querySelector(path)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFooterLinkClick = (link: string) => {
    switch (link) {
      case "Evaluation":
        setLocation("/evaluate");
        break;
      case "Dashboard":
        setLocation("/dashboard");
        break;
      case "Knowledge base":
        setKnowledgeOpen(true);
        break;
      case "Analytics":
        setLocation("/dashboard");
        break;
      case "Reports":
        setLocation("/dashboard");
        break;
      case "How it works":
        go("#how-it-works");
        break;
      case "Architecture":
        setLocation("/architecture");
        break;
      case "Documentation":
      case "Research":
        setDocOpen(true);
        break;
      case "About":
        openInfo("About VeriAI", "Platform Mission", [
          "VeriAI was founded to solve one of the most critical challenges in generative AI: making LLM outputs trustworthy, verifiable, and explainable.",
          "Rather than evaluating responses based on superficial plausibility, VeriAI breaks down responses into individual factual claims and grounds them against canonical knowledge corpuses using pgvector and multi-agent consensus.",
          "Our platform powers automated quality testing, hallucination audits, and compliance reporting for leading AI engineering teams.",
        ]);
        break;
      case "Contact":
        setContactOpen(true);
        break;
      case "Privacy":
        openInfo("Privacy Policy", "Zero Retention Commitment", [
          "VeriAI operates on a strict zero-retention guarantee for customer evaluation prompts unless explicitly marked for storage by your team.",
          "All evaluation queries, reference documents, and model outputs are processed in isolated memory sandboxes and encrypted in transit (TLS 1.3) and at rest (AES-256).",
          "We never use customer prompts, evaluation results, or uploaded corpuses to train or fine-tune public foundation models.",
        ]);
        break;
      case "Terms":
        openInfo("Terms of Service", "Acceptable Use & SLAs", [
          "By accessing the VeriAI platform and evaluation APIs, you agree to adhere to standard rate limits and responsible AI safety practices.",
          "High-throughput enterprise workloads can be executed asynchronously through our batch evaluation pipeline with dedicated pgvector instances.",
          "VeriAI provides objective evidence-backed quality scores, but recommendations in regulated domains (healthcare, law, finance) should always incorporate expert human review.",
        ]);
        break;
      default:
        toast.info(`${link} section opened.`);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fffefd] text-[#17151c]">
      {/* Interactive Modals */}
      <SignInModal open={signInOpen} onOpenChange={setSignInOpen} />
      <EvidenceModal open={evidenceOpen} onOpenChange={setEvidenceOpen} />
      <KnowledgeBaseModal open={knowledgeOpen} onOpenChange={setKnowledgeOpen} />
      <DocumentationModal open={docOpen} onOpenChange={setDocOpen} />
      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
      <InfoModal
        open={infoModal.open}
        onOpenChange={(open) => setInfoModal((prev) => ({ ...prev, open }))}
        title={infoModal.title}
        eyebrow={infoModal.eyebrow}
        content={infoModal.content}
      />

      {/* Header */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
          scrolled
            ? "border-[#e9e4ef] bg-white/90 shadow-[0_8px_30px_rgba(30,20,47,0.05)] backdrop-blur-xl"
            : "border-transparent bg-white/75 backdrop-blur-md"
        }`}
      >
        <div className="container flex h-[72px] items-center justify-between gap-5">
          <a
            href="#top"
            onClick={(event) => {
              event.preventDefault();
              go("#top");
            }}
          >
            <Logo />
          </a>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Primary navigation">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(event) => {
                  event.preventDefault();
                  go(item.href);
                }}
                className="text-[12px] font-semibold text-[#6a6571] transition-colors hover:text-[#6d28d9]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            {userProfile.isLoggedIn ? (
              <button
                onClick={() => setSignInOpen(true)}
                className="flex items-center gap-2 rounded-full border border-[#dcd5e7] bg-white px-3 py-1.5 text-xs font-semibold text-[#484252] shadow-sm hover:border-[#6d28d9]"
              >
                <span className="grid size-5 place-items-center rounded-full bg-[#6d28d9] text-[10px] font-bold text-white">
                  {userProfile.name.charAt(0)}
                </span>
                <span>{userProfile.name.split(" ")[0]}</span>
                <span className="rounded bg-[#e9f8ed] px-1.5 py-0.2 text-[9px] font-bold text-[#16803b]">
                  Pro
                </span>
              </button>
            ) : (
              <button
                onClick={() => setSignInOpen(true)}
                className="text-[12px] font-semibold text-[#6a6571] transition-colors hover:text-[#17151c]"
              >
                Sign in
              </button>
            )}

            <button
              onClick={() => setLocation("/evaluate")}
              className="group inline-flex items-center gap-2 rounded-full bg-[#6d28d9] px-4 py-2.5 text-[12px] font-bold text-white shadow-[0_8px_20px_rgba(109,40,217,0.2)] transition-all hover:-translate-y-0.5 hover:bg-[#5b21b6] active:scale-[0.97]"
            >
              Try VeriAI{" "}
              <ArrowUpRight
                size={14}
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </button>
          </div>

          <button
            className="grid size-10 place-items-center rounded-xl border border-[#e8e3ed] text-[#4e4857] sm:hidden"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileOpen && (
          <div className="border-t border-[#ece8f1] bg-white px-4 py-4 sm:hidden">
            <div className="container grid gap-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(event) => {
                    event.preventDefault();
                    go(item.href);
                  }}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[#4e4857] hover:bg-[#f7f3ff] hover:text-[#6d28d9]"
                >
                  {item.label}
                </a>
              ))}
              <div className="my-2 border-t border-[#eee9f4]" />
              <button
                onClick={() => {
                  setMobileOpen(false);
                  setSignInOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-[#4e4857] hover:bg-[#f7f3ff]"
              >
                <User size={15} /> {userProfile.isLoggedIn ? userProfile.name : "Sign in / Register"}
              </button>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  setLocation("/evaluate");
                }}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#6d28d9] px-4 py-3 text-sm font-bold text-white shadow-md"
              >
                Try VeriAI <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-[#eeeaf2] pt-32 sm:pt-40">
          <div className="absolute inset-0 bg-grid opacity-50" />
          <div className="absolute -left-40 top-32 size-[480px] rounded-full bg-[#eee7ff] opacity-50 blur-3xl" />
          <div className="absolute -right-40 top-16 size-[440px] rounded-full bg-[#f1e8ff] opacity-70 blur-3xl" />
          <div className="container relative grid items-center gap-14 pb-20 lg:grid-cols-[0.86fr_1.14fr] lg:gap-12 lg:pb-28">
            <div className="max-w-[620px]">
              <Eyebrow>Evidence-grounded AI evaluation</Eyebrow>
              <h1 className="font-display text-[clamp(3.25rem,7vw,6.4rem)] font-semibold leading-[0.93] tracking-[-0.075em] text-[#17151c]">
                Know when your AI is <span className="text-[#6d28d9]">right.</span>
              </h1>
              <p className="mt-7 max-w-xl font-display text-[clamp(1.2rem,2.5vw,1.8rem)] font-medium leading-[1.15] tracking-[-0.045em] text-[#38313f]">
                Validate every response <span className="text-[#8b5cf6]">with evidence.</span>
              </p>
              <p className="mt-6 max-w-lg text-[15px] leading-7 text-[#6d6874]">
                VeriAI evaluates AI-generated responses for relevance, accuracy, hallucination risk, and completeness — grounded in trusted evidence.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setLocation("/evaluate")}
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-[#6d28d9] px-6 py-3.5 text-[13px] font-bold text-white shadow-[0_12px_28px_rgba(109,40,217,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[#5b21b6] active:scale-[0.97]"
                >
                  Evaluate a response{" "}
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>
                <button
                  onClick={() => go("#how-it-works")}
                  className="group inline-flex items-center justify-center gap-2 rounded-full border border-[#dcd5e7] bg-white/60 px-5 py-3.5 text-[13px] font-bold text-[#423b4b] transition-all hover:border-[#b9a8d4] hover:bg-white active:scale-[0.97]"
                >
                  Explore how it works{" "}
                  <ArrowRight
                    size={16}
                    className="text-[#8e7aa9] transition-transform group-hover:translate-x-1"
                  />
                </button>
              </div>
              <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-semibold text-[#8b8591]">
                <span className="flex items-center gap-1.5">
                  <Check size={13} className="text-[#16a34a]" /> No model training required
                </span>
                <span className="hidden size-1 rounded-full bg-[#c8c1d0] sm:block" />
                <span className="flex items-center gap-1.5">
                  <Check size={13} className="text-[#16a34a]" /> Evidence-grounded evaluation
                </span>
                <span className="hidden size-1 rounded-full bg-[#c8c1d0] sm:block" />
                <span className="flex items-center gap-1.5">
                  <Check size={13} className="text-[#16a34a]" /> Explainable results
                </span>
              </div>
            </div>

            <EvaluationMockup />
          </div>
        </section>

        {/* Feature Badges Banner */}
        <section className="border-b border-[#eeeaf2] bg-[#fbfafc] py-5">
          <div className="container flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.17em] text-[#827b8c]">
              Built for evidence-grounded AI evaluation
            </div>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 lg:w-auto lg:gap-8">
              <span className="flex items-center gap-2 text-[11px] font-semibold text-[#595360]">
                <CheckCircle2 size={15} className="text-[#6d28d9]" /> Evidence-based
              </span>
              <span className="flex items-center gap-2 text-[11px] font-semibold text-[#595360]">
                <CheckCircle2 size={15} className="text-[#6d28d9]" /> Multi-dimensional
              </span>
              <span className="flex items-center gap-2 text-[11px] font-semibold text-[#595360]">
                <CheckCircle2 size={15} className="text-[#6d28d9]" /> Explainable results
              </span>
              <span className="flex items-center gap-2 text-[11px] font-semibold text-[#595360]">
                <CheckCircle2 size={15} className="text-[#6d28d9]" /> Built to scale
              </span>
            </div>
          </div>
        </section>

        {/* The Problem */}
        <section id="product" className="container section-space">
          <SectionHeading
            eyebrow="The problem"
            title="AI can sound confident and still be wrong."
            description="Traditional AI evaluation often stops at whether an answer looks convincing. VeriAI goes further by examining the response against relevant evidence and evaluating multiple dimensions of response quality."
          />
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            <ProblemCard
              icon={AlertTriangle}
              tone="red"
              title="Confident but incorrect"
              description="AI models can generate plausible statements that are factually incorrect."
            />
            <ProblemCard
              icon={Layers}
              tone="amber"
              title="Relevant but incomplete"
              description="A response can answer the general question while missing important information."
            />
            <ProblemCard
              icon={ScanSearch}
              tone="violet"
              title="Unsupported claims"
              description="Some claims may have little or no support in the available reference evidence."
            />
          </div>
        </section>

        {/* Workflow */}
        <section id="how-it-works" className="border-y border-[#eeeaf2] bg-[#f8f6fb] section-space">
          <div className="container">
            <SectionHeading
              eyebrow="The workflow"
              title="One response. Multiple checks. One clear verdict."
              description="A transparent evaluation path that turns a raw model response into a structured, explainable result."
            />
            <div className="mt-14 flex flex-col gap-3 lg:flex-row lg:items-stretch">
              {workflowSteps.map((step, index) => (
                <div key={step.number} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="group flex min-h-[152px] flex-1 flex-col justify-between rounded-2xl border border-[#e6e0ee] bg-white p-4 shadow-[0_8px_22px_rgba(44,25,69,0.04)] transition-all hover:-translate-y-1 hover:border-[#c9b6eb] hover:shadow-[0_14px_28px_rgba(44,25,69,0.08)]">
                    <div className="flex items-start justify-between">
                      <span className="font-display text-[11px] font-semibold text-[#a39aa9]">
                        {step.number}
                      </span>
                      <step.icon size={18} className="text-[#7c3aed]" />
                    </div>
                    <div>
                      <div className="font-display text-[15px] font-semibold tracking-[-0.04em] text-[#27232d]">
                        {step.title}
                      </div>
                      <div className="mt-1 text-[11px] leading-4 text-[#85808c]">
                        {step.detail}
                      </div>
                    </div>
                  </div>
                  {index < workflowSteps.length - 1 && <ArrowConnector />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Evaluation Loop */}
        <section id="evaluation" className="container section-space">
          <SectionHeading
            eyebrow="The evaluation loop"
            title="How VeriAI evaluates an AI response"
            description="A layered pipeline designed to keep technical depth understandable — from the initial request to the final dashboard."
          />
          <div className="mt-14 grid gap-5 lg:grid-cols-[0.7fr_1.3fr] lg:items-start">
            <div className="rounded-3xl bg-[#18131f] p-6 text-white shadow-[0_24px_50px_rgba(33,22,47,0.12)] sm:p-8">
              <div className="mb-7 flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-200/65">
                  System pipeline
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#a7f3b7]">
                  <span className="size-1.5 rounded-full bg-[#7bea98]" /> ready
                </div>
              </div>
              <div className="space-y-0">
                {[
                  "User input",
                  "FastAPI API layer",
                  "Evaluation orchestrator",
                  "RAG retrieval",
                  "Evaluation agents",
                  "Verdict agent",
                  "Structured result",
                  "Dashboard",
                ].map((label, index) => (
                  <div key={label} className="flex items-center gap-3">
                    <div
                      className={`grid size-8 shrink-0 place-items-center rounded-lg border ${
                        index === 0 || index === 7
                          ? "border-violet-300/40 bg-violet-400/15 text-violet-200"
                          : "border-white/10 bg-white/[0.05] text-violet-200/80"
                      }`}
                    >
                      <span className="font-display text-[10px] font-bold">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3.5 py-2.5 text-[11px] font-medium text-violet-50/85">
                      {label}
                    </div>
                    {index < 7 && (
                      <div className="absolute ml-4 mt-16 h-5 w-px bg-violet-400/25" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <PipelineCard
                icon={Search}
                title="RAG retrieval"
                description="Find relevant information from trusted reference sources."
              />
              <PipelineCard
                icon={GitBranch}
                title="Evaluation orchestrator"
                description="Coordinates retrieval and evaluation tasks."
              />
              <PipelineCard
                icon={Boxes}
                title="Judge agents"
                description="Analyze different dimensions of response quality."
              />
              <PipelineCard
                icon={ShieldCheck}
                title="Verdict agent"
                description="Combines evaluation signals into a final decision."
              />
              <div className="rounded-2xl border border-dashed border-[#cfc2e8] bg-[#faf8ff] p-5 sm:col-span-2">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-[#eee7ff] text-[#6d28d9]">
                    <PanelTop size={18} />
                  </span>
                  <div>
                    <div className="font-display text-[15px] font-semibold tracking-[-0.04em] text-[#2d2637]">
                      Structured results → dashboard
                    </div>
                    <div className="mt-1 text-[12px] leading-5 text-[#777080]">
                      Every signal is stored as a readable, traceable evaluation report.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4 Dimensions */}
        <section className="border-y border-[#eeeaf2] bg-[#fbfafc] section-space">
          <div className="container">
            <SectionHeading
              eyebrow="Evaluation dimensions"
              title="Four ways to validate an AI response."
              description="A score is more useful when you can see the dimensions behind it — and the evidence that shaped each one."
            />
            <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {dimensions.map((dimension) => (
                <DimensionCard key={dimension.label} {...dimension} />
              ))}
            </div>
          </div>
        </section>

        {/* Claim-Level Inspection with interactive claim selector */}
        <section className="container section-space">
          <div className="grid items-center gap-12 lg:grid-cols-[0.82fr_1.18fr]">
            <div>
              <SectionHeading
                eyebrow="Claim-level inspection"
                title="Don't just score the answer. Inspect the claims."
                description="VeriAI analyzes individual assertions and compares them with retrieved evidence to identify supported, partially supported, and potentially unsupported statements."
              />
              <div className="mt-7 flex items-center gap-2 text-[11px] font-semibold text-[#7e7688]">
                <Eye size={15} className="text-[#6d28d9]" /> Click any claim on the right to inspect its evidence
              </div>
            </div>
            <ClaimInspection />
          </div>
        </section>

        {/* Evidence Visibility Section with working modal trigger */}
        <section className="border-y border-[#eeeaf2] bg-[#f8f6fb] section-space">
          <div className="container">
            <div className="grid items-start gap-12 lg:grid-cols-[0.72fr_1.28fr]">
              <SectionHeading
                eyebrow="Evidence visibility"
                title="Every verdict should have a reason."
                description="See the evidence behind the evaluation instead of receiving a score with no explanation."
              />
              <div className="space-y-3">
                <EvidenceCard
                  source="SQuAD reference dataset"
                  relevance="94%"
                  evidence="Photosynthesis is the process by which green plants convert light energy into chemical energy..."
                />
                <EvidenceCard
                  source="Reference document"
                  relevance="88%"
                  evidence="...plants use chlorophyll to absorb light and begin the conversion process."
                />
                <button
                  onClick={() => setEvidenceOpen(true)}
                  className="group mt-2 inline-flex items-center gap-2 text-[12px] font-bold text-[#6d28d9] hover:underline"
                >
                  View all evidence in interactive browser{" "}
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Result Preview Dashboard */}
        <section className="container section-space">
          <div className="rounded-[32px] bg-[#18131f] p-5 shadow-[0_28px_60px_rgba(33,22,47,0.14)] sm:p-8 lg:p-10">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <SectionHeading
                light
                eyebrow="Evaluation result preview"
                title="From raw AI response to explainable verdict."
                description="A dashboard that makes the signal legible for builders, researchers, and evaluation teams."
              />
              <button
                onClick={() => setLocation("/dashboard")}
                className="hidden size-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-violet-200 sm:grid hover:bg-white/10 hover:text-white transition"
              >
                <ArrowUpRight size={20} />
              </button>
            </div>
            <ResultDashboard />
          </div>
        </section>

        {/* Modular Architecture Link */}
        <section className="border-y border-[#eeeaf2] bg-[#fbfafc] section-space">
          <div className="container">
            <div className="flex flex-col justify-between gap-7 md:flex-row md:items-end">
              <SectionHeading
                eyebrow="Modular by design"
                title="Designed as a modular AI evaluation system."
                description="A clear separation between inputs, retrieval, judges, storage, and reporting keeps the platform easy to extend."
              />
              <button
                onClick={() => setLocation("/architecture")}
                className="group inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[#dcd5e7] bg-white px-4 py-3 text-[12px] font-bold text-[#423b4b] transition-all hover:border-[#b9a8d4] hover:text-[#6d28d9] md:self-end"
              >
                View system architecture{" "}
                <ArrowUpRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </button>
            </div>
            <ArchitectureDiagram />
          </div>
        </section>

        {/* Knowledge Base Section */}
        <section className="container section-space">
          <div className="grid items-start gap-12 lg:grid-cols-[0.75fr_1.25fr]">
            <SectionHeading
              eyebrow="Knowledge base"
              title="Ground evaluation in trusted knowledge."
              description="VeriAI can use curated benchmark datasets and reference documents to retrieve evidence for evaluation."
            />
            <div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div
                  onClick={() => setKnowledgeOpen(true)}
                  className="cursor-pointer transition-transform hover:-translate-y-1"
                >
                  <KnowledgeCard
                    title="TruthfulQA"
                    description="Benchmark dataset focused on truthful question answering."
                    icon={BookOpenCheck}
                  />
                </div>
                <div
                  onClick={() => setKnowledgeOpen(true)}
                  className="cursor-pointer transition-transform hover:-translate-y-1"
                >
                  <KnowledgeCard
                    title="SQuAD 2.0"
                    description="Question answering dataset containing questions and contextual evidence."
                    icon={FileCheck2}
                  />
                </div>
                <div
                  onClick={() => setKnowledgeOpen(true)}
                  className="cursor-pointer transition-transform hover:-translate-y-1"
                >
                  <KnowledgeCard
                    title="Custom Docs"
                    description="Upload your own trusted source material for grounded evaluation."
                    icon={FileText}
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-[#e7e1ef] bg-[#fbfafc] p-4 text-[10px] font-bold uppercase tracking-[0.13em] text-[#766d81] sm:gap-3">
                <span className="rounded-lg bg-white px-2.5 py-2 shadow-sm">Documents</span>
                <ChevronRight size={13} className="text-[#b7a3d2]" />
                <span className="rounded-lg bg-white px-2.5 py-2 shadow-sm">Cleaning</span>
                <ChevronRight size={13} className="text-[#b7a3d2]" />
                <span className="rounded-lg bg-white px-2.5 py-2 shadow-sm">Chunking</span>
                <ChevronRight size={13} className="text-[#b7a3d2]" />
                <span className="rounded-lg bg-white px-2.5 py-2 shadow-sm">Embeddings</span>
                <ChevronRight size={13} className="text-[#b7a3d2]" />
                <button
                  onClick={() => setKnowledgeOpen(true)}
                  className="rounded-lg bg-[#eee7ff] px-2.5 py-2 text-[#6d28d9] font-bold hover:bg-[#e4d8fb]"
                >
                  Manage Knowledge Base →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section id="use-cases" className="border-y border-[#eeeaf2] bg-[#f8f6fb] section-space">
          <div className="container">
            <SectionHeading
              align="center"
              eyebrow="Use cases"
              title="Built for teams that need to trust AI outputs."
            />
            <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {useCases.map(([title, description, Icon]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-[#e6e0ee] bg-white p-5 transition-all hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(44,25,69,0.07)]"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-[#f0eaff] text-[#6d28d9]">
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-5 font-display text-[15px] font-semibold tracking-[-0.04em] text-[#28232f]">
                    {title}
                  </h3>
                  <p className="mt-2 text-[12px] leading-5 text-[#777080]">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why VeriAI */}
        <section className="container section-space">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
            <SectionHeading
              eyebrow="Why VeriAI"
              title="More than a score."
              description="A useful evaluation system helps you see what happened, why it happened, and what to do next."
            />
            <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2">
              {[
                ["Evidence-backed", "Understand what information influenced the evaluation.", Search],
                ["Multi-dimensional", "Evaluate relevance, accuracy, hallucination risk, and completeness separately.", Gauge],
                ["Explainable", "See why the system produced its verdict.", Eye],
                ["Scalable", "Designed to support individual evaluations as well as batch evaluation.", Network],
              ].map(([title, description, Icon]) => (
                <div key={title as string} className="border-t border-[#e8e3ed] pt-5">
                  <Icon size={19} className="text-[#6d28d9]" />
                  <h3 className="mt-4 font-display text-lg font-semibold tracking-[-0.045em] text-[#28232f]">
                    {title as string}
                  </h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#777080]">
                    {description as string}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Banner */}
        <section className="container py-20 sm:py-28">
          <div className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,#6d28d9_0%,#4c1d95_56%,#30123f_100%)] px-6 py-14 text-center shadow-[0_24px_65px_rgba(76,29,149,0.26)] sm:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.22),transparent_28%),radial-gradient(circle_at_90%_80%,rgba(196,181,253,0.3),transparent_33%)]" />
            <div className="absolute inset-0 opacity-15 [background-image:repeating-linear-gradient(115deg,rgba(255,255,255,0.12)_0_1px,transparent_1px_8px)]" />
            <div className="relative mx-auto max-w-2xl">
              <Sparkles className="mx-auto mb-5 text-violet-200" size={23} />
              <h2 className="font-display text-4xl font-semibold leading-[1.02] tracking-[-0.06em] text-white sm:text-5xl">
                Ready to see what your AI really said?
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-[15px] leading-7 text-violet-100/80">
                Evaluate an AI response and see its relevance, accuracy, hallucination risk, completeness, and supporting evidence.
              </p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  onClick={() => setLocation("/evaluate")}
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-[13px] font-bold text-[#5b21b6] transition-all hover:-translate-y-0.5 hover:bg-violet-50 active:scale-[0.97]"
                >
                  Evaluate a response{" "}
                  <ArrowRight
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </button>
                <button
                  onClick={() => setLocation("/dashboard")}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-6 py-3.5 text-[13px] font-bold text-white transition-all hover:border-white/60 hover:bg-white/10 active:scale-[0.97]"
                >
                  Explore the platform <ArrowUpRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with Working Click Handlers */}
      <footer className="border-t border-[#eeeaf2] bg-[#fbfafc] py-12">
        <div className="container">
          <div className="grid gap-10 lg:grid-cols-[1.6fr_repeat(4,1fr)]">
            <div>
              <Logo />
              <p className="mt-4 max-w-xs text-[12px] leading-6 text-[#78717f]">
                Validate AI responses. Detect hallucinations. Trust the evidence.
              </p>
            </div>
            <FooterColumn
              title="Product"
              links={["Evaluation", "Dashboard", "Knowledge base", "Analytics", "Reports"]}
              onLinkClick={handleFooterLinkClick}
            />
            <FooterColumn
              title="Resources"
              links={["How it works", "Architecture", "Documentation", "Research"]}
              onLinkClick={handleFooterLinkClick}
            />
            <FooterColumn
              title="Company"
              links={["About", "Contact"]}
              onLinkClick={handleFooterLinkClick}
            />
            <FooterColumn
              title="Legal"
              links={["Privacy", "Terms"]}
              onLinkClick={handleFooterLinkClick}
            />
          </div>
          <div className="mt-12 flex flex-col justify-between gap-3 border-t border-[#e6e1ea] pt-5 text-[11px] text-[#8b8491] sm:flex-row">
            <span>© 2026 VeriAI. All rights reserved.</span>
            <span>Evidence-led evaluation for the next generation of AI.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProblemCard({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: typeof AlertTriangle;
  tone: "red" | "amber" | "violet";
  title: string;
  description: string;
}) {
  const tones = {
    red: "bg-[#fff0f0] text-[#dc2626]",
    amber: "bg-[#fff6e9] text-[#d97706]",
    violet: "bg-[#f0eaff] text-[#6d28d9]",
  };
  return (
    <div className="rounded-2xl border border-[#e8e3ed] bg-white p-6 shadow-[0_8px_24px_rgba(44,25,69,0.035)]">
      <span className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon size={19} />
      </span>
      <h3 className="mt-7 font-display text-[18px] font-semibold tracking-[-0.045em] text-[#28232f]">
        {title}
      </h3>
      <p className="mt-2 max-w-xs text-[13px] leading-6 text-[#777080]">{description}</p>
    </div>
  );
}

function PipelineCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Search;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e7e1ef] bg-white p-5 transition-all hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(44,25,69,0.07)]">
      <span className="grid size-9 place-items-center rounded-xl bg-[#f0eaff] text-[#6d28d9]">
        <Icon size={17} />
      </span>
      <h3 className="mt-5 font-display text-[15px] font-semibold tracking-[-0.04em] text-[#28232f]">
        {title}
      </h3>
      <p className="mt-2 text-[12px] leading-5 text-[#777080]">{description}</p>
    </div>
  );
}

function DimensionCard({
  index,
  label,
  question,
  score,
  suffix,
  description,
  icon: Icon,
  tone,
}: (typeof dimensions)[number]) {
  const tones: Record<string, string> = {
    violet: "bg-[#f0eaff] text-[#6d28d9]",
    green: "bg-[#eaf8ed] text-[#16803b]",
    amber: "bg-[#fff4df] text-[#b45309]",
    blue: "bg-[#eaf2ff] text-[#2563eb]",
  };
  return (
    <div className="group rounded-2xl border border-[#e7e1ef] bg-white p-5 transition-all hover:-translate-y-1 hover:border-[#cfc0e8] hover:shadow-[0_16px_32px_rgba(44,25,69,0.07)]">
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] font-semibold text-[#aaa2af]">{index}</span>
        <span className={`grid size-8 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon size={16} />
        </span>
      </div>
      <div className="mt-7 text-[10px] font-bold uppercase tracking-[0.15em] text-[#7d7485]">
        {label}
      </div>
      <p className="mt-3 min-h-[54px] font-display text-[16px] font-semibold leading-[1.15] tracking-[-0.04em] text-[#2b2532]">
        {question}
      </p>
      <div className="mt-6 flex items-end gap-1">
        <span className="font-display text-3xl font-semibold tracking-[-0.07em] text-[#17151c]">
          {score}
        </span>
        <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#928b9a]">
          {suffix}
        </span>
      </div>
      <p className="mt-4 border-t border-[#eeeaf2] pt-4 text-[12px] leading-5 text-[#777080]">
        {description}
      </p>
    </div>
  );
}

function ClaimInspection() {
  const [selectedClaim, setSelectedClaim] = useState<number>(0);

  const claimsData = [
    {
      text: "Photosynthesis occurs in green plants and algae.",
      status: "supported" as const,
      source: "SQuAD 2.0 Biology Corpus",
      evidence: "Photosynthesis takes place in chloroplasts in plants and algae, converting light into carbohydrates.",
      analysis: "Plant process confirmed with high confidence (98% cosine similarity).",
    },
    {
      text: "It converts sunlight into chemical energy stored as glucose.",
      status: "supported" as const,
      source: "NCBI Science Reference",
      evidence: "Solar photons excite electrons in chlorophyll, driving ATP generation and hexose sugar storage.",
      analysis: "Energy conversion mechanism verified against reference literature.",
    },
    {
      text: "Plants perform photosynthesis only during direct daylight.",
      status: "partial" as const,
      source: "Plant Metabolism Review (OpenStax)",
      evidence: "Light-dependent reactions require sunlight; however, light-independent Calvin cycle reactions can proceed using stored ATP.",
      analysis: "Partially supported: Dark reactions do not directly require concurrent illumination.",
    },
  ];

  return (
    <div className="rounded-3xl border border-[#e7e1ef] bg-white p-4 shadow-[0_16px_35px_rgba(44,25,69,0.06)] sm:p-5">
      <div className="grid gap-4 md:grid-cols-[1fr_0.88fr]">
        <div className="rounded-2xl bg-[#fbfafc] p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="label-kicker">AI response claims</div>
            <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#9b94a3]">
              3 claims
            </span>
          </div>

          <div className="space-y-2 text-[12px] leading-relaxed">
            {claimsData.map((c, i) => (
              <button
                key={i}
                onClick={() => setSelectedClaim(i)}
                className={`w-full text-left rounded-xl p-3 border transition ${
                  selectedClaim === i
                    ? "border-[#6d28d9] bg-[#f5efff] shadow-sm"
                    : "border-[#ebe5f3] bg-white hover:border-[#cfc1e8]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[10px] text-[#797183] uppercase">
                    Claim 0{i + 1}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      c.status === "supported"
                        ? "bg-[#eaf8ed] text-[#16803b]"
                        : "bg-[#fff5e5] text-[#b45309]"
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[#352f3f] font-medium">{c.text}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#18131f] p-4 text-white flex flex-col justify-between">
          <div>
            <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-200/70">
                Corroborating Evidence
              </div>
              <ScanSearch size={16} className="text-violet-300" />
            </div>

            <div className="text-[10px] font-bold text-violet-300 uppercase tracking-wider">
              {claimsData[selectedClaim].source}
            </div>
            <p className="mt-2 text-xs italic leading-relaxed text-violet-100/80 bg-white/[0.05] p-3 rounded-xl border border-white/10">
              "{claimsData[selectedClaim].evidence}"
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="text-[10px] font-bold uppercase text-[#a7f3b7]">
              Judge Finding:
            </div>
            <div className="text-[11px] text-violet-50/80 mt-1">
              {claimsData[selectedClaim].analysis}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidenceCard({
  source,
  relevance,
  evidence,
}: {
  source: string;
  relevance: string;
  evidence: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e6e0ee] bg-white p-5 shadow-[0_8px_24px_rgba(44,25,69,0.035)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#948c9d]">
            Source
          </div>
          <div className="mt-1.5 font-display text-[15px] font-semibold tracking-[-0.035em] text-[#302a38]">
            {source}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#948c9d]">
            Relevance
          </div>
          <div className="mt-1.5 font-display text-xl font-semibold tracking-[-0.05em] text-[#6d28d9]">
            {relevance}
          </div>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-[#fbfafc] p-3.5 text-[12px] leading-5 text-[#5e5767]">
        “{evidence}”
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#16803b]">
        <CheckCircle2 size={14} /> Supports claim
      </div>
    </div>
  );
}

function ResultDashboard() {
  const [, setLocation] = useLocation();

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#231b2d]">
      <div className="grid gap-0 lg:grid-cols-[0.42fr_0.58fr]">
        <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-200/60">
            Overall evaluation
          </div>
          <div className="mt-4 flex items-end gap-2">
            <span className="font-display text-6xl font-semibold leading-none tracking-[-0.08em] text-white">
              91
            </span>
            <span className="mb-1.5 text-sm font-semibold text-violet-100/55">/ 100</span>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1f8a48]/20 px-3 py-1.5 text-[11px] font-bold text-[#a7f3b7]">
            <CheckCircle2 size={14} /> PASS · high confidence
          </div>
          <div className="mt-8">
            <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-violet-100/50">
              <span>Evidence support</span>
              <span>9 claims checked</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
              <div className="w-[78%] bg-[#7bea98]" />
              <div className="w-[12%] bg-[#f2bd5d]" />
              <div className="w-[10%] bg-white/10" />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-semibold text-violet-100/65">
              <span>
                <strong className="text-[#a7f3b7]">8</strong> supported
              </span>
              <span>
                <strong className="text-[#f6c36a]">1</strong> partial
              </span>
              <span>
                <strong className="text-white/80">0</strong> unsupported
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Relevance", "96", "#a78bfa"],
              ["Accuracy", "94", "#7bea98"],
              ["Hallucination risk", "6%", "#f6c36a"],
              ["Completeness", "86", "#93c5fd"],
            ].map(([label, value, color]) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.035] p-4"
              >
                <div className="text-[10px] font-semibold text-violet-100/55">{label}</div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="font-display text-3xl font-semibold tracking-[-0.07em] text-white">
                    {value}
                  </span>
                  <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-100/55">
                Why this verdict?
              </div>
              <Sparkles size={15} className="text-violet-300" />
            </div>
            <div className="mt-4 grid gap-2 text-[11px] font-medium text-violet-50/80 sm:grid-cols-2">
              <span className="flex items-center gap-2">
                <Check size={13} className="text-[#8bf0a7]" /> Directly answers the question
              </span>
              <span className="flex items-center gap-2">
                <Check size={13} className="text-[#8bf0a7]" /> Claims supported by evidence
              </span>
              <span className="flex items-center gap-2">
                <Check size={13} className="text-[#8bf0a7]" /> No major unsupported claims
              </span>
              <span className="flex items-center gap-2">
                <BellRing size={13} className="text-[#f6c36a]" /> Minor completeness issue
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArchitectureDiagram() {
  const [, setLocation] = useLocation();

  return (
    <div className="mt-12 rounded-3xl border border-[#e6e0ee] bg-white p-5 shadow-[0_12px_28px_rgba(44,25,69,0.04)] sm:p-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-2">
        <ArchitectureNode label="VeriAI · evaluation input" icon={ShieldCheck} tone="violet" />
        <div className="diagram-line" />
        <ArchitectureNode label="FastAPI API layer" icon={Network} />
        <div className="diagram-line" />
        <ArchitectureNode label="Evaluation orchestrator" icon={GitBranch} />
        <div className="my-2 grid w-full gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-[#e6e0ee] bg-[#fbfafc] p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-[#f0eaff] text-[#6d28d9]">
                <Search size={17} />
              </span>
              <div>
                <div className="font-display text-[14px] font-semibold tracking-[-0.04em] text-[#322b39]">
                  RAG retrieval
                </div>
                <div className="mt-1 text-[11px] text-[#827a89]">Trusted evidence</div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#e6e0ee] bg-[#fbfafc] p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-[#f0eaff] text-[#6d28d9]">
                <Boxes size={17} />
              </span>
              <div>
                <div className="font-display text-[14px] font-semibold tracking-[-0.04em] text-[#322b39]">
                  Judge agents
                </div>
                <div className="mt-1 text-[11px] text-[#827a89]">
                  Relevance · accuracy · risk · completeness
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="diagram-line" />
        <ArchitectureNode label="Verdict agent" icon={BadgeCheck} tone="green" />
        <div className="diagram-line" />
        <div className="grid w-full gap-3 sm:grid-cols-2">
          <ArchitectureNode label="Structured results" icon={FileCheck2} />
          <ArchitectureNode label="Dashboard + reports" icon={BarChart3} />
        </div>
      </div>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#827a89]">
        <span className="rounded-full bg-[#f4f1f8] px-3 py-2">PostgreSQL</span>
        <span className="text-[#b8a7d3]">+</span>
        <span className="rounded-full bg-[#eee7ff] px-3 py-2 text-[#6d28d9]">pgvector</span>
        <span className="ml-1 font-medium normal-case tracking-normal text-[#9b93a2]">
          storage layer
        </span>
      </div>
    </div>
  );
}

function ArchitectureNode({
  label,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  icon: typeof ShieldCheck;
  tone?: "default" | "violet" | "green";
}) {
  const styles = {
    default: "border-[#e6e0ee] bg-white text-[#322b39]",
    violet: "border-[#cfc0e8] bg-[#faf8ff] text-[#6d28d9]",
    green: "border-[#cde9d4] bg-[#f4fbf5] text-[#16803b]",
  };
  return (
    <div
      className={`flex w-full items-center justify-center gap-3 rounded-2xl border px-4 py-3.5 font-display text-[14px] font-semibold tracking-[-0.035em] ${styles[tone]}`}
    >
      <Icon size={17} />
      {label}
    </div>
  );
}

function KnowledgeCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof FileText;
}) {
  return (
    <div className="rounded-2xl border border-[#e6e0ee] bg-white p-4 shadow-sm hover:border-[#cfc0e8] transition">
      <span className="grid size-8 place-items-center rounded-lg bg-[#f0eaff] text-[#6d28d9]">
        <Icon size={16} />
      </span>
      <h3 className="mt-4 font-display text-[14px] font-semibold tracking-[-0.04em] text-[#322b39]">
        {title}
      </h3>
      <p className="mt-2 text-[11px] leading-5 text-[#81798b]">{description}</p>
    </div>
  );
}

function FooterColumn({
  title,
  links,
  onLinkClick,
}: {
  title: string;
  links: string[];
  onLinkClick: (link: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#777080]">
        {title}
      </div>
      <div className="mt-4 grid gap-3">
        {links.map((link) => (
          <button
            key={link}
            onClick={() => onLinkClick(link)}
            className="w-fit text-left text-[12px] text-[#777080] transition-colors hover:text-[#6d28d9]"
          >
            {link}
          </button>
        ))}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { useLocation } from "wouter";
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  FileText,
  Gauge,
  Layers,
  LogOut,
  Menu,
  Network,
  Play,
  Settings,
  ShieldCheck,
  User,
  X,
  Zap,
} from "lucide-react";
import { useEvaluation } from "@/contexts/EvaluationContext";
import { toast } from "sonner";

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export default function AppLayout({
  title,
  subtitle,
  eyebrow,
  children,
  actions,
}: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const { userProfile, logoutUser } = useEvaluation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const navigationItems = [
    { name: "Dashboard", path: "/dashboard", icon: Gauge },
    { name: "Evaluate", path: "/evaluate", icon: Play },
    { name: "Batch Evaluation", path: "/batch", icon: Layers },
    { name: "History", path: "/history", icon: Clock },
    { name: "Knowledge Base", path: "/knowledge-base", icon: Database },
    { name: "Analytics", path: "/analytics", icon: BarChart3 },
    { name: "Reports", path: "/reports", icon: FileText },
    { name: "Architecture", path: "/architecture", icon: Network },
    { name: "Documentation", path: "/docs", icon: BookOpenCheck },
  ];

  const handleLogout = () => {
    logoutUser();
    toast.success("Signed out of VeriAI Workspace");
    setLocation("/login");
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between p-4">
      {/* Top section */}
      <div>
        {/* Logo */}
        <button
          onClick={() => {
            setLocation("/dashboard");
            setMobileDrawerOpen(false);
          }}
          className="flex w-full items-center gap-3 px-2 py-3 text-left transition hover:opacity-85"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-[#6d28d9] text-white shadow-[0_4px_14px_rgba(109,40,217,0.3)]">
            <ShieldCheck size={20} />
          </span>
          <div>
            <div className="font-display text-[1.12rem] font-bold tracking-tight text-[#17151c]">
              Veri<span className="text-[#6d28d9]">AI</span>
            </div>
            <div className="text-[10px] font-medium tracking-wide text-[#797184]">
              Evaluation Platform
            </div>
          </div>
        </button>

        {/* Primary Navigation */}
        <nav className="mt-6 space-y-1">
          {navigationItems.map((item) => {
            const isActive = location === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => {
                  setLocation(item.path);
                  setMobileDrawerOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[#6d28d9] text-white shadow-sm shadow-[#6d28d9]/20"
                    : "text-[#585163] hover:bg-[#f6f2fd] hover:text-[#6d28d9]"
                }`}
              >
                <Icon size={16} className={isActive ? "text-white" : "text-[#7c7488]"} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="space-y-3 border-t border-[#ede7f5] pt-4">
        {/* Settings button */}
        <button
          onClick={() => {
            setLocation("/settings");
            setMobileDrawerOpen(false);
          }}
          className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
            location === "/settings"
              ? "bg-[#6d28d9] text-white shadow-sm shadow-[#6d28d9]/20"
              : "text-[#585163] hover:bg-[#f6f2fd] hover:text-[#6d28d9]"
          }`}
        >
          <Settings size={16} className={location === "/settings" ? "text-white" : "text-[#7c7488]"} />
          <span>Settings</span>
        </button>

        {/* User profile card */}
        <div className="flex items-center justify-between rounded-2xl border border-[#ece5f4] bg-[#fbf9fe] p-2.5">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#6d28d9]/10 text-xs font-bold text-[#6d28d9]">
              {userProfile.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2) || "AM"}
            </span>
            <div className="truncate text-left">
              <div className="truncate text-xs font-bold text-[#1e1927]">
                {userProfile.name || "Alex Morgan"}
              </div>
              <div className="truncate text-[10px] text-[#837b8f]">
                {userProfile.email || "alex@veriai.dev"}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Sign out"
            className="grid size-7 shrink-0 place-items-center rounded-lg text-[#797185] transition hover:bg-[#f2ecfa] hover:text-[#b91c1c]"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#faf9fc] text-[#17151c]">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-[#ece5f4] bg-white lg:block">
        <div className="sticky top-0 h-screen">{navContent}</div>
      </aside>

      {/* Mobile Drawer Backdrop & Menu */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative z-10 w-72 bg-white shadow-2xl">
            <div className="absolute right-3 top-3">
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-[#655e71] hover:bg-[#f4effb]"
              >
                <X size={18} />
              </button>
            </div>
            {navContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[#ece5f4] bg-white/95 px-4 backdrop-blur-md sm:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="grid size-9 place-items-center rounded-xl border border-[#ece5f4] text-[#585163] hover:bg-[#f6f2fd] lg:hidden"
            >
              <Menu size={18} />
            </button>

            {/* Breadcrumb / Page Title */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#837b8f]">
                <button
                  onClick={() => setLocation("/dashboard")}
                  className="hover:text-[#6d28d9]"
                >
                  VeriAI
                </button>
                <ChevronRight size={12} />
                <span className="text-[#6d28d9]">{title}</span>
              </div>
            </div>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-3">
            {/* Database status pill */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-[#d9f2e3] bg-[#f0fbf4] px-3 py-1 text-[11px] font-semibold text-[#16a34a]">
              <span className="size-1.5 rounded-full bg-[#16a34a] animate-pulse" />
              <span>pgvector Active (2,066 chunks)</span>
            </div>

            {/* Quick action button */}
            {location !== "/evaluate" && (
              <button
                onClick={() => setLocation("/evaluate")}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#6d28d9] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm shadow-[#6d28d9]/25 transition hover:bg-[#5b21b6]"
              >
                <Play size={12} /> Evaluate
              </button>
            )}

            {/* Overview / Landing Page Link */}
            <button
              onClick={() => setLocation("/")}
              className="hidden md:inline-flex items-center gap-1 rounded-full border border-[#e5dfef] bg-white px-3 py-1 text-xs font-semibold text-[#665e72] hover:bg-[#f7f4fb] hover:text-[#17151c]"
            >
              Overview
            </button>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
          {/* Page Title & Subtitle */}
          {(title || subtitle || eyebrow) && (
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                {eyebrow && (
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[#6d28d9]">
                    {eyebrow}
                  </div>
                )}
                <h1 className="font-display text-2xl font-bold tracking-tight text-[#17151c] sm:text-3xl">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-1 text-xs text-[#736c7e] sm:text-sm">
                    {subtitle}
                  </p>
                )}
              </div>
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}

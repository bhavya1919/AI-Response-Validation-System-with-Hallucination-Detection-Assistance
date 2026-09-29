import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEvaluation } from "@/contexts/EvaluationContext";
import { toast } from "sonner";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { userProfile, loginUser } = useEvaluation();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // If user is already logged in, redirect directly to /dashboard
  useEffect(() => {
    if (userProfile.isLoggedIn) {
      setLocation("/dashboard");
    }
  }, [userProfile.isLoggedIn, setLocation]);

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
    setLocation("/dashboard");
  };

  const handleDemoSignIn = () => {
    loginUser("alex.morgan@evalai.org", "Alex Morgan");
    toast.success("Signed in as Demo User: Alex Morgan");
    setLocation("/dashboard");
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#faf9fc] py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* VeriAI Branding */}
        <div className="flex items-center justify-center gap-2.5">
          <span className="grid size-11 place-items-center rounded-2xl bg-[#6d28d9] text-white shadow-[0_8px_20px_rgba(109,40,217,0.3)]">
            <ShieldCheck size={24} />
          </span>
          <span className="font-display text-2xl font-bold tracking-tight text-[#17151c]">
            Veri<span className="text-[#6d28d9]">AI</span> Workspace
          </span>
        </div>

        <h2 className="mt-6 text-center font-display text-2xl font-semibold tracking-tight text-[#17151c]">
          {isRegister ? "Create your workspace account" : "Sign in to VeriAI"}
        </h2>
        <p className="mt-2 text-center text-xs text-[#736c7e]">
          {isRegister
            ? "Get instant access to automated evidence retrieval & judge pipelines."
            : "Access your saved evaluations, API keys, and custom benchmarks."}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-3xl border border-[#e8e2f0] bg-white p-6 shadow-[0_18px_45px_rgba(35,20,55,0.06)] sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
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
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-[#6d28d9] py-3 text-xs font-bold text-white shadow-md shadow-[#6d28d9]/25 transition hover:bg-[#5b21b6]"
            >
              <LogIn size={14} /> {isRegister ? "Create Account" : "Sign In to Workspace"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#ede7f4]" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-[11px] font-medium text-[#8f879b]">
                Or continue with one click
              </span>
            </div>
          </div>

          {/* One-click Demo Sign In */}
          <button
            type="button"
            onClick={handleDemoSignIn}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d6cbe9] bg-[#f8f5fc] py-2.5 text-xs font-bold text-[#6d28d9] transition hover:bg-[#efe8fa]"
          >
            <Sparkles size={14} /> Continue as Demo User (Alex Morgan)
          </button>

          {/* Toggle Register / Sign In */}
          <div className="mt-5 text-center text-xs text-[#7d7587]">
            {isRegister ? "Already have an account?" : "Need a workspace account?"}{" "}
            <button
              type="button"
              onClick={() => setIsRegister(!isRegister)}
              className="font-bold text-[#6d28d9] hover:underline"
            >
              {isRegister ? "Sign in" : "Create one now"}
            </button>
          </div>
        </div>

        {/* Security & Grounding footnote */}
        <div className="mt-6 flex items-center justify-center gap-2 text-center text-[11px] text-[#8e8798]">
          <CheckCircle2 size={13} className="text-[#16a34a]" />
          <span>Multi-agent factual verification grounded in certified corpuses</span>
        </div>
      </div>
    </div>
  );
}

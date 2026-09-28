import React, { useState } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  EyeOff,
  Key,
  Lock,
  Save,
  Settings as SettingsIcon,
  Sliders,
  User,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useEvaluation } from "@/contexts/EvaluationContext";
import { toast } from "sonner";

export default function Settings() {
  const { userProfile, loginUser } = useEvaluation();

  // Settings states
  const [name, setName] = useState(userProfile.name);
  const [email, setEmail] = useState(userProfile.email);
  const [defaultTopK, setDefaultTopK] = useState("10");
  const [defaultDataset, setDefaultDataset] = useState("all");
  const [strictContradictions, setStrictContradictions] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  const mockApiKey = "vai_live_8f0a2c91b45de6739901";

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    loginUser(email, name);
    toast.success("Profile updated successfully.");
  };

  const handleSavePreferences = () => {
    toast.success("Evaluation and knowledge preferences saved.");
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(mockApiKey);
    toast.success("API key copied to clipboard.");
  };

  return (
    <AppLayout
      eyebrow="Preferences"
      title="Workspace Settings"
      subtitle="Manage your profile, evaluation jury parameters, and knowledge base preferences."
    >
      <div className="max-w-3xl space-y-8">
        {/* User Profile Section */}
        <section className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 text-[#6d28d9] mb-1">
            <User size={18} />
            <h2 className="font-display text-base font-bold text-[#17151c]">
              Profile Information
            </h2>
          </div>
          <p className="text-xs text-[#736c7e] mb-5">
            Your personal credentials and evaluation workspace tier.
          </p>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#635c6f] mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-[#ded7e8] bg-[#fbfafc] p-2.5 text-xs text-[#17151c] outline-none focus:border-[#6d28d9] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#635c6f] mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#ded7e8] bg-[#fbfafc] p-2.5 text-xs text-[#17151c] outline-none focus:border-[#6d28d9] focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#ede7f4] pt-4">
              <span className="text-xs text-[#7a7285]">
                Plan: <strong className="text-[#16a34a] font-bold">{userProfile.tier}</strong>
              </span>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#6d28d9] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#5b21b6]"
              >
                <Save size={13} /> Save Profile
              </button>
            </div>
          </form>
        </section>

        {/* API Credentials */}
        <section className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 text-[#6d28d9] mb-1">
            <Key size={18} />
            <h2 className="font-display text-base font-bold text-[#17151c]">
              API Credentials
            </h2>
          </div>
          <p className="text-xs text-[#736c7e] mb-4">
            Use this key to authenticate programmatic requests to <code>/api/evaluate</code>.
          </p>

          <div className="flex items-center gap-2 rounded-xl border border-[#ded7e8] bg-[#fbfafc] p-2.5 text-xs font-mono">
            <span className="flex-1 text-[#2d2639]">
              {showApiKey ? mockApiKey : "vai_live_••••••••••••••••••••"}
            </span>
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              title="Toggle view"
              className="grid size-7 place-items-center rounded-lg text-[#7c7487] hover:bg-[#ede7f5]"
            >
              {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              onClick={handleCopyKey}
              title="Copy key"
              className="grid size-7 place-items-center rounded-lg text-[#7c7487] hover:bg-[#ede7f5]"
            >
              <Copy size={14} />
            </button>
          </div>
        </section>

        {/* Evaluation Preferences */}
        <section className="rounded-3xl border border-[#ece5f4] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2 text-[#6d28d9] mb-1">
            <Sliders size={18} />
            <h2 className="font-display text-base font-bold text-[#17151c]">
              Evaluation Preferences
            </h2>
          </div>
          <p className="text-xs text-[#736c7e] mb-4">
            Configure default multi-agent parameters for the evaluation studio.
          </p>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#635c6f] mb-1.5">
                  Default Retrieval Top-K
                </label>
                <select
                  value={defaultTopK}
                  onChange={(e) => setDefaultTopK(e.target.value)}
                  className="w-full rounded-xl border border-[#ded7e8] bg-[#fbfafc] p-2.5 text-xs text-[#17151c] outline-none focus:border-[#6d28d9]"
                >
                  <option value="5">Top 5 passages</option>
                  <option value="10">Top 10 passages (Recommended)</option>
                  <option value="15">Top 15 passages</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#635c6f] mb-1.5">
                  Default Knowledge Base Scope
                </label>
                <select
                  value={defaultDataset}
                  onChange={(e) => setDefaultDataset(e.target.value)}
                  className="w-full rounded-xl border border-[#ded7e8] bg-[#fbfafc] p-2.5 text-xs text-[#17151c] outline-none focus:border-[#6d28d9]"
                >
                  <option value="all">All Datasets (Multi-Hop)</option>
                  <option value="squad">SQuAD v1.1 Only</option>
                  <option value="truthfulqa">TruthfulQA Only</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#ede7f4] pt-4">
              <span className="text-xs text-[#7a7285]">
                Strict semantic clash detection is enabled.
              </span>
              <button
                onClick={handleSavePreferences}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#6d28d9] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#5b21b6]"
              >
                <Save size={13} /> Save Preferences
              </button>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

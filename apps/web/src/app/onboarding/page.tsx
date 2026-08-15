"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { setWorkspaces, setSelectedWorkspace } from "@/store/slices/authSlice";
import { RootState } from "@/store";
import { useSetupWorkspaceMutation, useWorkspaces } from "@/hooks/queries/useWorkspaceQueries";
import { useToast } from "@/components/ui/ToastProvider";
import {
  Bot,
  Building2,
  Globe,
  Sparkles,
  Palette,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Zap,
  Shield,
  Layers,
} from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const toast = useToast();
  const { user } = useSelector((state: RootState) => state.auth);

  const setupMutation = useSetupWorkspaceMutation();
  const { refetch: refetchWorkspaces } = useWorkspaces(false);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    website_url: "",
    industry: "SaaS & Tech",
    brand_name: "",
    primary_color: "#D4AF37",
    greeting_message: "Hello! How can our AI assistant help you today?",
    plan_name: "Free",
  });

  const colorPresets = [
    { label: "Gold Glow", hex: "#D4AF37" },
    { label: "Electric Indigo", hex: "#6366F1" },
    { label: "Emerald AI", hex: "#10B981" },
    { label: "Cyber Rose", hex: "#F43F5E" },
    { label: "Ocean Cyan", hex: "#0EA5E9" },
  ];

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCompleteOnboarding = async () => {
    if (!formData.name.trim()) {
      setError("Please provide your company name.");
      setStep(1);
      return;
    }

    setError(null);
    try {
      await setupMutation.mutateAsync({
        business_name: formData.name,
        website_url: formData.website_url,
        industry: formData.industry,
      });

      const { data: freshWorkspaces } = await refetchWorkspaces();
      if (freshWorkspaces) {
        dispatch(setWorkspaces(freshWorkspaces));
        if (freshWorkspaces.length > 0) {
          dispatch(setSelectedWorkspace(freshWorkspaces[0]));
        }
      }

      toast.success("Workspace setup completed successfully!");
      router.push("/dashboard");
    } catch (err: any) {
      const msg = err.message || "Failed to create workspace. Please try again.";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col justify-between p-4 sm:p-8">
      {/* Top Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-4 border-b border-[#1F1F1F]">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20">
            <Bot className="h-6 w-6 text-[#050505]" />
          </div>
          <span className="font-extrabold text-xl tracking-tight">
            Support<span className="text-[#D4AF37]">AI</span>
          </span>
        </div>

        {/* Wizard Step Indicator */}
        <div className="flex items-center space-x-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                step === i
                  ? "w-8 bg-[#D4AF37]"
                  : step > i
                  ? "w-2.5 bg-[#D4AF37]/50"
                  : "w-2.5 bg-[#222222]"
              }`}
            />
          ))}
        </div>
      </header>

      {/* Main Form Container */}
      <main className="max-w-4xl mx-auto w-full my-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* STEP 1: Business Profile */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <h1 className="text-3xl font-extrabold tracking-tight">
                Let&apos;s set up your business workspace
              </h1>
              <p className="text-sm text-neutral-400">
                Welcome {user?.name || "there"}! Tell us about your company so your AI Support Agent can be tailored for your audience.
              </p>
            </div>

            <div className="max-w-xl mx-auto bg-[#111111] border border-[#222222] rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center space-x-2">
                  <Building2 className="h-4 w-4 text-[#D4AF37]" />
                  <span>Company or Organization Name *</span>
                </label>
                <input
                  type="text"
                  placeholder="Acme Corp"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-[#222222] text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-[#D4AF37]" />
                  <span>Company Website URL</span>
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={formData.website_url}
                  onChange={(e) => handleChange("website_url", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-[#222222] text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center space-x-2">
                  <Layers className="h-4 w-4 text-[#D4AF37]" />
                  <span>Industry</span>
                </label>
                <select
                  value={formData.industry}
                  onChange={(e) => handleChange("industry", e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-[#222222] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
                >
                  <option value="SaaS & Tech">SaaS & Software</option>
                  <option value="E-Commerce">E-Commerce & Retail</option>
                  <option value="Fintech">Fintech & Financial Services</option>
                  <option value="Healthcare">Healthcare & Digital Health</option>
                  <option value="Education">EdTech & Education</option>
                  <option value="Other">Other Enterprise Services</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!formData.name.trim()) {
                    setError("Please enter your company name to proceed.");
                    return;
                  }
                  setError(null);
                  setStep(2);
                }}
                className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-[#D4AF37]/20"
              >
                <span>Continue to AI Agent Setup</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: AI Widget & Branding Preview */}
        {step === 2 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <h1 className="text-3xl font-extrabold tracking-tight">
                Customize your AI Widget & Persona
              </h1>
              <p className="text-sm text-neutral-400">
                Design the embedded chat widget your customers will interact with on your website.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Configuration Controls */}
              <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-5 shadow-2xl">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center space-x-2">
                    <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                    <span>Widget Brand Name</span>
                  </label>
                  <input
                    type="text"
                    placeholder={formData.name || "SupportAI Assistant"}
                    value={formData.brand_name}
                    onChange={(e) => handleChange("brand_name", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-[#222222] text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center space-x-2">
                    <Palette className="h-4 w-4 text-[#D4AF37]" />
                    <span>Brand Primary Accent Color</span>
                  </label>
                  <div className="flex items-center space-x-2 mb-3">
                    {colorPresets.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => handleChange("primary_color", c.hex)}
                        style={{ backgroundColor: c.hex }}
                        className={`h-8 w-8 rounded-full border-2 transition-transform ${
                          formData.primary_color === c.hex ? "border-white scale-110" : "border-transparent"
                        }`}
                        title={c.label}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => handleChange("primary_color", e.target.value)}
                    className="h-10 w-full rounded-xl bg-[#050505] border border-[#222222] cursor-pointer p-1"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-2 flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4 text-[#D4AF37]" />
                    <span>Greeting Message</span>
                  </label>
                  <textarea
                    rows={3}
                    value={formData.greeting_message}
                    onChange={(e) => handleChange("greeting_message", e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#050505] border border-[#222222] text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
                  />
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-neutral-300 font-semibold text-sm transition-all border border-[#2A2A2A]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] font-bold text-sm hover:brightness-110 transition-all shadow-md"
                  >
                    <span>Choose Plan</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Live Preview Widget */}
              <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-2xl flex flex-col justify-between h-full min-h-[420px]">
                <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                    Live Chat Widget Preview
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                    Interactive Mode
                  </span>
                </div>

                {/* Render Simulated Widget Window */}
                <div className="bg-[#050505] border border-[#222222] rounded-xl overflow-hidden shadow-xl flex flex-col h-[320px]">
                  {/* Header */}
                  <div
                    style={{ backgroundColor: formData.primary_color }}
                    className="p-4 text-black flex items-center justify-between transition-colors duration-300"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="h-8 w-8 rounded-full bg-black/20 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-black" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm leading-tight">
                          {formData.brand_name || formData.name || "SupportAI Bot"}
                        </h4>
                        <p className="text-[10px] opacity-80">AI Support Agent</p>
                      </div>
                    </div>
                  </div>

                  {/* Body Messages */}
                  <div className="p-4 flex-1 space-y-3 overflow-y-auto">
                    <div className="flex items-start space-x-2">
                      <div
                        style={{ backgroundColor: formData.primary_color }}
                        className="h-6 w-6 rounded-full flex items-center justify-center text-black text-[10px] font-bold shrink-0 mt-0.5"
                      >
                        AI
                      </div>
                      <div className="bg-[#181818] border border-[#262626] rounded-2xl rounded-tl-xs p-3 text-xs text-neutral-200 max-w-[80%] leading-relaxed shadow-sm">
                        {formData.greeting_message}
                      </div>
                    </div>
                  </div>

                  {/* Input Footer */}
                  <div className="p-3 border-t border-[#181818] bg-[#0A0A0A] flex items-center space-x-2">
                    <input
                      type="text"
                      disabled
                      placeholder="Type a message..."
                      className="w-full bg-[#141414] border border-[#222222] rounded-lg px-3 py-1.5 text-xs text-neutral-400"
                    />
                    <button
                      type="button"
                      style={{ backgroundColor: formData.primary_color }}
                      className="p-2 rounded-lg text-black font-bold shrink-0"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Plan Selection */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="text-center space-y-2 max-w-xl mx-auto">
              <h1 className="text-3xl font-extrabold tracking-tight">
                Select your platform plan
              </h1>
              <p className="text-sm text-neutral-400">
                Start with a 14-day free trial. Upgrade or change your tier at any time.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Free Plan */}
              <div
                onClick={() => handleChange("plan_name", "Free")}
                className={`cursor-pointer rounded-2xl p-6 border transition-all relative flex flex-col justify-between space-y-6 ${
                  formData.plan_name === "Free"
                    ? "bg-[#111111] border-[#D4AF37] shadow-xl shadow-[#D4AF37]/10"
                    : "bg-[#0A0A0A] border-[#222222] hover:border-[#333333]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-neutral-300">Starter</span>
                    <Zap className="h-4 w-4 text-[#D4AF37]" />
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold">$0</span>
                    <span className="text-xs text-neutral-400"> / month</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-neutral-300">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                      <span>1,000 AI Messages/mo</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                      <span>3 Team Seat Licenses</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                      <span>Website Crawler & PDF RAG</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Growth Pro Plan */}
              <div
                onClick={() => handleChange("plan_name", "Growth")}
                className={`cursor-pointer rounded-2xl p-6 border transition-all relative flex flex-col justify-between space-y-6 ${
                  formData.plan_name === "Growth"
                    ? "bg-[#111111] border-[#D4AF37] shadow-xl shadow-[#D4AF37]/10"
                    : "bg-[#0A0A0A] border-[#222222] hover:border-[#333333]"
                }`}
              >
                <div className="absolute -top-3 right-6 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-[#050505] text-[10px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider">
                  Popular
                </div>
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-neutral-300">Growth Pro</span>
                    <Sparkles className="h-4 w-4 text-[#D4AF37]" />
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold">$49</span>
                    <span className="text-xs text-neutral-400"> / month</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-neutral-300">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                      <span>10,000 AI Messages/mo</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                      <span>10 Team Seat Licenses</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                      <span>Human Takeover Live Inbox</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Enterprise Plan */}
              <div
                onClick={() => handleChange("plan_name", "Enterprise")}
                className={`cursor-pointer rounded-2xl p-6 border transition-all relative flex flex-col justify-between space-y-6 ${
                  formData.plan_name === "Enterprise"
                    ? "bg-[#111111] border-[#D4AF37] shadow-xl shadow-[#D4AF37]/10"
                    : "bg-[#0A0A0A] border-[#222222] hover:border-[#333333]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-neutral-300">Enterprise</span>
                    <Shield className="h-4 w-4 text-[#D4AF37]" />
                  </div>
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold">$199</span>
                    <span className="text-xs text-neutral-400"> / month</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-neutral-300">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                      <span>Unlimited AI Conversations</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                      <span>Unlimited Agent Seats</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-[#D4AF37]" />
                      <span>Custom Domain & SLA Support</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="max-w-xl mx-auto flex items-center space-x-3 pt-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={setupMutation.isPending}
                className="flex-1 flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-neutral-300 font-semibold text-sm transition-all border border-[#2A2A2A] disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleCompleteOnboarding}
                disabled={setupMutation.isPending}
                className="flex-1 flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] font-bold text-sm hover:brightness-110 transition-all shadow-lg shadow-[#D4AF37]/20 disabled:opacity-60"
              >
                {setupMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#050505]" />
                ) : (
                  <>
                    <span>Complete Workspace Setup</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center text-xs text-neutral-500 py-4 border-t border-[#1F1F1F]">
        SupportAI Enterprise SaaS Platform &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

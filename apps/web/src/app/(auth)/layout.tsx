import React from "react";
import { Bot, Sparkles, ShieldCheck, Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#050505] text-white font-sans selection:bg-gold-500 selection:text-[#050505]">
      {/* Left side: Premium Enterprise AI Black + Gold Showcase */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-[#0a0a0a] border-r border-[#1a1a1a]">
        {/* Glow ambient background elements */}
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#F4D03F]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header Branding */}
        <div className="flex items-center space-x-3 z-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20">
            <Bot className="h-6 w-6 text-[#050505]" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Support<span className="text-[#D4AF37]">AI</span>
          </span>
        </div>

        {/* Hero Copy & Feature Cards */}
        <div className="space-y-8 z-10 my-auto">
          <div className="space-y-4">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#111111] border border-[#D4AF37]/30 text-[#F4D03F] text-xs font-medium tracking-wide">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span>Black & Gold Enterprise Intelligence</span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white leading-tight">
              Transform customer support with <span className="gold-text-gradient">high-precision AI</span>.
            </h1>
            <p className="text-neutral-400 text-base leading-relaxed max-w-md">
              Ingest enterprise documentation, deploy custom AI models, and deliver immediate 24/7 resolution with ultra-low latency.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="p-4 rounded-xl bg-[#111111] border border-[#222222] hover:border-[#D4AF37]/40 transition-colors flex items-start space-x-4">
              <div className="p-2.5 rounded-lg bg-[#D4AF37]/10 text-[#D4AF37]">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Sub-second AI Resolutions</h4>
                <p className="text-xs text-neutral-400 mt-0.5">Automate 80%+ of routine inquiries with pgvector similarity search.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#111111] border border-[#222222] hover:border-[#D4AF37]/40 transition-colors flex items-start space-x-4">
              <div className="p-2.5 rounded-lg bg-[#F4D03F]/10 text-[#F4D03F]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Enterprise Multi-Tenancy & RBAC</h4>
                <p className="text-xs text-neutral-400 mt-0.5">Strict workspace isolation and granular role permissions built for scale.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-xs text-neutral-500 z-10">
          © {new Date().getFullYear()} SupportAI Inc. Black + Gold Intelligence Architecture.
        </div>
      </div>

      {/* Right side: Form container */}
      <div className="flex flex-col justify-center items-center p-6 sm:p-12 bg-[#050505] relative">
        <div className="w-full max-w-md space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
}

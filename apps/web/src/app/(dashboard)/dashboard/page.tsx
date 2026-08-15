"use client";

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useAnalyticsSummary } from "@/hooks/queries/useAnalyticsQueries";
import { useConversations } from "@/hooks/queries/useInboxQueries";
import { useWebSources, useFileSources } from "@/hooks/queries/useSourcesQueries";
import { useToast } from "@/components/ui/ToastProvider";
import { OverviewMetrics } from "./components/OverviewMetrics";
import { OverviewConversations } from "./components/OverviewConversations";
import {
  Code2,
  Copy,
  Check,
  Globe,
  FileText,
  Bot,
  ArrowUpRight,
} from "lucide-react";

export default function DashboardOverviewPage() {
  const toast = useToast();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const user = useSelector((state: RootState) => state.auth.user);
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const workspaces = useSelector((state: RootState) => state.auth.workspaces || []);
  const activeWs = selectedWorkspace || (workspaces.length > 0 ? workspaces[0] : null);
  const activeWsId = activeWs?.id;

  const [copied, setCopied] = useState(false);

  const { data: analyticsSummary, isLoading: loadingAnalytics } = useAnalyticsSummary("7d", activeWsId);
  const { data: conversations = [], isLoading: loadingConversations } = useConversations(activeWsId);
  const { data: webSources = [], isLoading: loadingWeb } = useWebSources(activeWsId);
  const { data: fileSources = [], isLoading: loadingFiles } = useFileSources(activeWsId);

  const loading = loadingAnalytics || loadingConversations || loadingWeb || loadingFiles;
  const sourcesCount = webSources.length + fileSources.length;
  const recentConversations = conversations.slice(0, 5);

  const embedScript = `<script\n  src="http://localhost:8000/widget.js"\n  data-workspace-id="${activeWs?.workspace_uuid || activeWs?.id || ""}"\n  async\n></script>`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(embedScript);
    setCopied(true);
    toast.success("Widget embed snippet copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#111111] via-[#161616] to-[#111111] border border-[#222222] rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] text-xs font-semibold">
            <Bot className="h-3.5 w-3.5" />
            <span>AI Support Engine Active</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {user?.name || "Partner"}
          </h2>
          <p className="text-sm text-neutral-400 max-w-xl">
            Managing <strong className="text-white">{activeWs?.business?.name || "your organization"}</strong>. Your AI agent is actively handling customer support inquiries.
          </p>
        </div>

        <div className="flex items-center space-x-3 z-10 shrink-0">
          <a
            href="/onboarding"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] text-xs font-extrabold hover:brightness-110 transition-all shadow-md flex items-center space-x-2"
          >
            <span>Update AI Widget</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <div className="absolute right-0 top-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Metrics Grid Component */}
      <OverviewMetrics summary={analyticsSummary} sourcesCount={sourcesCount} />

      {/* Embed Code Snippet & Knowledge Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Widget Embed Code Generator */}
        <div className="lg:col-span-2 bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
            <div className="flex items-center space-x-2.5">
              <Code2 className="h-5 w-5 text-[#D4AF37]" />
              <h3 className="text-sm font-bold text-neutral-200">Embed Chat Widget on your Website</h3>
            </div>
            <span className="text-xs text-neutral-500 font-mono">HTML Snippet</span>
          </div>

          <p className="text-xs text-neutral-400 leading-relaxed">
            Copy and paste this lightweight snippet right before the closing <code>&lt;/body&gt;</code> tag of your website HTML to activate your AI support widget.
          </p>

          <div className="relative bg-[#050505] border border-[#222222] rounded-xl p-4 font-mono text-xs text-[#D4AF37] overflow-x-auto">
            <pre>{embedScript}</pre>
            <button
              type="button"
              onClick={handleCopySnippet}
              className="absolute top-3 right-3 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] text-white text-xs font-semibold transition-all border border-[#333333]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-neutral-400" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Knowledge Source Actions */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-2xl flex flex-col justify-between">
          <div className="pb-3 border-b border-[#222222]">
            <h3 className="text-sm font-bold text-neutral-200">Train your AI Agent</h3>
            <p className="text-xs text-neutral-400 mt-1">Import content to build your RAG vector knowledge base.</p>
          </div>

          <div className="space-y-3">
            <a
              href="/dashboard/knowledge"
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-[#222222] hover:border-[#D4AF37]/40 transition-all text-xs text-neutral-300 font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <Globe className="h-4 w-4 text-[#D4AF37]" />
                <span>Crawl Website URL</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-neutral-500 group-hover:text-white transition-colors" />
            </a>

            <a
              href="/dashboard/knowledge"
              className="w-full flex items-center justify-between p-3 rounded-xl bg-[#050505] border border-[#222222] hover:border-[#D4AF37]/40 transition-all text-xs text-neutral-300 font-semibold group"
            >
              <div className="flex items-center space-x-3">
                <FileText className="h-4 w-4 text-[#D4AF37]" />
                <span>Upload PDF / Document</span>
              </div>
              <ArrowUpRight className="h-4 w-4 text-neutral-500 group-hover:text-white transition-colors" />
            </a>
          </div>

          <div className="p-3 rounded-xl bg-[#D4AF37]/5 border border-[#D4AF37]/20 text-[11px] text-[#D4AF37]">
            💡 AI models utilize pgvector vector search for context retrieval.
          </div>
        </div>
      </div>

      {/* Recent Conversations Component */}
      <OverviewConversations conversations={recentConversations} loading={loading} />
    </div>
  );
}

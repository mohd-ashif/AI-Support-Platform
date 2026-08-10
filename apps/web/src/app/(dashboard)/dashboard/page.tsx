"use client";

import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { apiFetch } from "@/lib/api";
import {
  MessageSquare,
  Sparkles,
  Zap,
  Clock,
  Code2,
  Copy,
  Check,
  Globe,
  FileText,
  Bot,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";

export default function DashboardOverviewPage() {
  const { isAuthenticated, user, selectedWorkspace, workspaces } = useSelector((state: RootState) => state.auth);
  const activeWs = selectedWorkspace || (workspaces.length > 0 ? workspaces[0] : null);

  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [recentConversations, setRecentConversations] = useState<any[]>([]);
  const [sourcesCount, setSourcesCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeWs?.id && isAuthenticated) {
      fetchOverviewData();
    }
  }, [activeWs?.id, isAuthenticated]);

  const fetchOverviewData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, convsRes, webRes, fileRes] = await Promise.all([
        apiFetch("/analytics/summary").catch(() => null),
        apiFetch("/conversations?limit=5").catch(() => null),
        apiFetch("/sources/web").catch(() => []),
        apiFetch("/sources/files").catch(() => []),
      ]);

      if (analyticsRes) setSummary(analyticsRes);
      if (convsRes?.items) setRecentConversations(convsRes.items);
      const totalSources = (webRes?.length || 0) + (fileRes?.length || 0);
      setSourcesCount(totalSources);
    } catch (e) {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };

  const embedScript = `<script\n  src="http://localhost:8000/widget.js"\n  data-workspace-id="${activeWs?.workspace_uuid || activeWs?.id || ""}"\n  async\n></script>`;

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(embedScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const metrics = [
    {
      title: "Total AI Conversations",
      value: summary?.total_conversations !== undefined ? summary.total_conversations.toLocaleString() : "—",
      change: summary?.conversations_change !== undefined ? `${summary.conversations_change >= 0 ? "+" : ""}${summary.conversations_change}%` : "—",
      icon: MessageSquare,
    },
    {
      title: "AI Resolution Rate",
      value: summary?.ai_resolution_rate !== undefined ? `${summary.ai_resolution_rate}%` : "—",
      change: summary?.resolution_rate_change !== undefined ? `${summary.resolution_rate_change >= 0 ? "+" : ""}${summary.resolution_rate_change}%` : "—",
      icon: Sparkles,
    },
    {
      title: "Avg Response Speed",
      value: summary?.avg_response_speed_ms !== undefined ? `${summary.avg_response_speed_ms} ms` : "—",
      change: summary?.speed_change_ms !== undefined ? `${summary.speed_change_ms} ms` : "—",
      icon: Clock,
    },
    {
      title: "Indexed Knowledge Base",
      value: `${sourcesCount} Sources`,
      change: `${sourcesCount} Active`,
      icon: Zap,
    },
  ];


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

        {/* Ambient glow */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.title}
              className="bg-[#111111] border border-[#222222] hover:border-[#D4AF37]/30 rounded-2xl p-5 space-y-4 transition-all shadow-xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">{m.title}</span>
                <div className="h-8 w-8 rounded-xl bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center text-[#D4AF37]">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black tracking-tight">{m.value}</span>
                <span className="text-[10px] font-bold text-emerald-400 flex items-center">
                  <TrendingUp className="h-3 w-3 mr-0.5" />
                  {m.change}
                </span>
              </div>
            </div>
          );
        })}
      </div>

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

      {/* Recent Conversations Table */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
          <h3 className="text-sm font-bold text-neutral-200">Recent Customer Support Conversations</h3>
          <span className="text-xs text-[#D4AF37] font-semibold cursor-pointer hover:underline">View All Inbox</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-neutral-500 border-b border-[#1A1A1A]">
                <th className="pb-3 font-semibold">Visitor</th>
                <th className="pb-3 font-semibold">Topic / Question</th>
                <th className="pb-3 font-semibold">Resolution Status</th>
                <th className="pb-3 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {recentConversations.map((c) => (
                <tr key={c.id} className="hover:bg-[#141414] transition-colors">
                  <td className="py-3 font-semibold text-white">{c.visitor}</td>
                  <td className="py-3 text-neutral-300">{c.topic}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        c.status === "AI Resolved"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 text-right text-neutral-500">{c.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

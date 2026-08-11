"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { apiFetch, getMemoryWorkspaceId } from "@/lib/api";
import { BarChart3, TrendingUp, Zap, Clock, Star, HelpCircle, Loader2, AlertCircle, RefreshCw } from "lucide-react";

export interface AnalyticsSeriesItem {
  date: string;
  conversations_count: number;
  ai_resolved_count: number;
  avg_response_ms: number;
}

export interface TopQuestion {
  question: string;
  count: number;
}

export interface AnalyticsSummary {
  total_conversations: number;
  overall_resolution_rate: number;
  avg_response_ms: number;
  csat_score: number | null;
  series: AnalyticsSeriesItem[];
  top_questions: TopQuestion[];
}

export default function AnalyticsPage() {
  const { selectedWorkspace } = useSelector((state: RootState) => state.auth);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("7d");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const activeWsId = selectedWorkspace?.id || selectedWorkspace?.workspace_id || getMemoryWorkspaceId() || "";
      const headers: Record<string, string> = {};
      if (activeWsId) {
        headers["X-Workspace-Id"] = activeWsId;
      }

      const res: AnalyticsSummary = await apiFetch(`/analytics/summary?range=${range}`, {
        headers,
      });
      setData(res);
    } catch (err: any) {
      console.error("[ANALYTICS_API_ERROR]", err);
      const msg = err?.message || "";
      if (msg.includes("403") || msg.toLowerCase().includes("permission")) {
        setError("You do not have permission to view analytics for this workspace.");
      } else if (msg.includes("422") || msg.toLowerCase().includes("validation")) {
        setError("Invalid query parameter range. Please select a valid option.");
      } else {
        setError("Unable to load analytics data. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, [range, selectedWorkspace]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const series = data?.series || [];
  const hasSeriesData = series.some((s) => s.conversations_count > 0 || s.ai_resolved_count > 0);
  const maxConvCount = Math.max(...series.map((s) => s.conversations_count), 1);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1F1F1F]">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-6 w-6 text-[#D4AF37]" />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">AI Resolution & Support Analytics</h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Track automated resolution rates, response latency, and CSAT customer satisfaction metrics.
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center space-x-1 bg-[#111111] border border-[#222222] p-1 rounded-xl">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <button
              key={r}
              type="button"
              disabled={loading}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                range === r
                  ? "bg-[#D4AF37] text-black shadow-md"
                  : "text-neutral-400 hover:text-white disabled:opacity-50"
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Error Alert View */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-center justify-between text-red-400 text-xs">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAnalytics}
            className="flex items-center space-x-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg font-bold transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold">Total Conversations</span>
            <TrendingUp className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <p className="text-3xl font-extrabold text-white">
            {loading ? <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" /> : (data?.total_conversations ?? 0)}
          </p>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold">Resolution Rate</span>
            <Zap className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-400">
            {loading ? <Loader2 className="h-6 w-6 animate-spin text-emerald-400" /> : `${data?.overall_resolution_rate ?? 0}%`}
          </p>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold">Average Response Time</span>
            <Clock className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <p className="text-3xl font-extrabold text-white">
            {loading ? <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" /> : `${data?.avg_response_ms ?? 0} ms`}
          </p>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-semibold">CSAT Score</span>
            <Star className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <p className="text-3xl font-extrabold text-amber-400">
            {loading ? <Loader2 className="h-6 w-6 animate-spin text-amber-400" /> : (data?.csat_score !== null && data?.csat_score !== undefined ? `${data.csat_score}/5.0` : "N/A")}
          </p>
        </div>
      </div>

      {/* Daily Volume Bar Chart */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-bold text-white">Continuous Daily Conversation Trend ({range.toUpperCase()})</h3>

        {loading ? (
          <div className="h-48 flex items-center justify-center text-xs text-neutral-400 space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
            <span>Loading analytics trend data...</span>
          </div>
        ) : series.length === 0 || !hasSeriesData ? (
          <div className="h-48 flex items-center justify-center text-xs text-neutral-500">
            No conversation data available for this period.
          </div>
        ) : (
          <div className="h-48 flex items-end justify-between gap-2 pt-6 border-b border-[#222222]">
            {series.map((item) => {
              const heightPercent = Math.max((item.conversations_count / maxConvCount) * 100, 4);
              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-2 group relative">
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className="w-full bg-gradient-to-t from-[#D4AF37]/40 to-[#D4AF37] rounded-t-sm group-hover:brightness-125 transition-all"
                  />
                  <span className="text-[9px] text-neutral-500 font-mono rotate-45 sm:rotate-0">
                    {item.date.substring(5)}
                  </span>

                  {/* Hover tooltip */}
                  <div className="absolute -top-10 hidden group-hover:flex bg-[#050505] border border-[#333333] text-white text-[10px] px-2 py-1 rounded shadow-xl whitespace-nowrap z-20">
                    {item.date}: {item.conversations_count} Convs ({item.ai_resolved_count} AI)
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Customer Questions */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
        <div className="flex items-center space-x-2">
          <HelpCircle className="h-5 w-5 text-[#D4AF37]" />
          <h3 className="text-sm font-bold text-white">Top Frequently Asked Customer Questions</h3>
        </div>

        <div className="divide-y divide-[#1A1A1A]">
          {loading ? (
            <div className="py-4 text-xs text-neutral-400 flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
              <span>Analyzing top customer questions...</span>
            </div>
          ) : !data?.top_questions || data.top_questions.length === 0 ? (
            <div className="py-4 text-xs text-neutral-500">
              No conversation data available for this period.
            </div>
          ) : (
            data.top_questions.map((q) => (
              <div key={q.question} className="py-3 flex items-center justify-between text-xs">
                <span className="text-neutral-200 font-semibold">{q.question}</span>
                <span className="bg-[#1F1F1F] text-[#D4AF37] px-2.5 py-1 rounded-full text-[10px] font-bold">
                  {q.count} times asked
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


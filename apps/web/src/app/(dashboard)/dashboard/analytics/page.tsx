"use client";

import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useAnalyticsSummary } from "@/hooks/queries/useAnalyticsQueries";
import { useFilterStore } from "@/stores/useFilterStore";
import { AnalyticsTrendChart } from "./components/AnalyticsTrendChart";
import { TopQuestionsTable } from "./components/TopQuestionsTable";
import { formatNumber, formatPercentage } from "@/lib/utils/format";
import { BarChart3, TrendingUp, Zap, Clock, Star, Loader2, AlertCircle, RefreshCw } from "lucide-react";

export default function AnalyticsPage() {
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const activeWsId = selectedWorkspace?.id;

  const range = useFilterStore((state) => state.analyticsRange);
  const setRange = useFilterStore((state) => state.setAnalyticsRange);

  const { data, isLoading, isError, error, refetch } = useAnalyticsSummary(range, activeWsId);

  const series = data?.series || [];

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
              disabled={isLoading}
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
      {isError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 flex items-center justify-between text-red-400 text-xs">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <span className="font-semibold">{error?.message || "Unable to load analytics data."}</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="flex items-center space-x-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-lg font-bold transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-neutral-400 flex flex-col items-center justify-center space-y-3 bg-[#111111] border border-[#222222] rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
          <span>Aggregating analytics data across knowledge resolution pipelines...</span>
        </div>
      ) : (
        <>
          {/* Key Metric KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* KPI 1: Total Conversations */}
            <div className="bg-[#111111] border border-[#222222] hover:border-[#D4AF37]/30 rounded-2xl p-5 space-y-3 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">Total Conversations</span>
                <TrendingUp className="h-4 w-4 text-[#D4AF37]" />
              </div>
              <p className="text-2xl font-extrabold text-white tracking-tight">
                {formatNumber(data?.total_conversations || 0)}
              </p>
              <p className="text-[11px] text-neutral-500">Inbound customer sessions recorded</p>
            </div>

            {/* KPI 2: AI Resolution Rate */}
            <div className="bg-[#111111] border border-[#222222] hover:border-[#D4AF37]/30 rounded-2xl p-5 space-y-3 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">AI Resolution Rate</span>
                <Zap className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-400 tracking-tight">
                {formatPercentage(data?.overall_resolution_rate || 0)}
              </p>
              <p className="text-[11px] text-neutral-500">Resolved autonomously without human handoff</p>
            </div>

            {/* KPI 3: Avg Response Latency */}
            <div className="bg-[#111111] border border-[#222222] hover:border-[#D4AF37]/30 rounded-2xl p-5 space-y-3 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">Avg Response Time</span>
                <Clock className="h-4 w-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-extrabold text-white tracking-tight">
                {formatNumber(data?.avg_response_ms || 0)} <span className="text-xs font-normal text-neutral-400">ms</span>
              </p>
              <p className="text-[11px] text-neutral-500">RAG query search + LLM generation speed</p>
            </div>

            {/* KPI 4: CSAT Rating */}
            <div className="bg-[#111111] border border-[#222222] hover:border-[#D4AF37]/30 rounded-2xl p-5 space-y-3 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-400">Customer CSAT</span>
                <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              </div>
              <p className="text-2xl font-extrabold text-amber-400 tracking-tight">
                {data?.csat_score !== undefined && data.csat_score !== null ? `${data.csat_score.toFixed(1)} / 5.0` : "4.8 / 5.0"}
              </p>
              <p className="text-[11px] text-neutral-500">User satisfaction post-resolution</p>
            </div>
          </div>

          {/* Analytics Trend Chart Component */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Daily Resolution Volume Trends</h3>
            <AnalyticsTrendChart series={series} loading={isLoading} range={range} />
          </div>

          {/* Top Inquired Questions Table Component */}
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Most Frequent Customer Inquiries</h3>
            <TopQuestionsTable questions={data?.top_questions || []} loading={isLoading} />
          </div>
        </>
      )}
    </div>
  );
}

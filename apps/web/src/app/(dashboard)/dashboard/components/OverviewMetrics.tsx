import React from "react";
import { MessageSquare, Sparkles, Clock, Zap, TrendingUp } from "lucide-react";
import { formatNumber } from "@/lib/utils/format";

interface OverviewMetricsProps {
  summary: any;
  sourcesCount: number;
}

export const OverviewMetrics: React.FC<OverviewMetricsProps> = ({ summary, sourcesCount }) => {
  const metrics = [
    {
      title: "Total AI Conversations",
      value: summary?.total_conversations !== undefined ? formatNumber(summary.total_conversations) : "—",
      change:
        summary?.conversations_change !== undefined
          ? `${summary.conversations_change >= 0 ? "+" : ""}${summary.conversations_change}%`
          : "—",
      icon: MessageSquare,
    },
    {
      title: "AI Resolution Rate",
      value: summary?.ai_resolution_rate !== undefined ? `${summary.ai_resolution_rate}%` : "—",
      change:
        summary?.resolution_rate_change !== undefined
          ? `${summary.resolution_rate_change >= 0 ? "+" : ""}${summary.resolution_rate_change}%`
          : "—",
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
      value: `${formatNumber(sourcesCount)} Sources`,
      change: `${sourcesCount} Active`,
      icon: Zap,
    },
  ];

  return (
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
  );
};

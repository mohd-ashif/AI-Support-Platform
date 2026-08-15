import React from "react";
import { Loader2 } from "lucide-react";

export interface AnalyticsSeriesItem {
  date: string;
  conversations_count: number;
  ai_resolved_count: number;
  avg_response_ms: number;
}

interface AnalyticsTrendChartProps {
  series: AnalyticsSeriesItem[];
  loading: boolean;
  range: string;
}

export const AnalyticsTrendChart: React.FC<AnalyticsTrendChartProps> = ({ series, loading, range }) => {
  const hasSeriesData = series.some((s) => s.conversations_count > 0 || s.ai_resolved_count > 0);
  const maxConvCount = Math.max(...series.map((s) => s.conversations_count), 1);

  return (
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
  );
};

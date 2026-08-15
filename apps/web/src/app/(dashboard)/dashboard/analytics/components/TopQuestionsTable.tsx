import React from "react";
import { HelpCircle, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/utils/format";

export interface TopQuestion {
  question: string;
  count: number;
}

interface TopQuestionsTableProps {
  questions?: TopQuestion[];
  loading: boolean;
}

export const TopQuestionsTable: React.FC<TopQuestionsTableProps> = ({ questions, loading }) => {
  return (
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
        ) : !questions || questions.length === 0 ? (
          <div className="py-4 text-xs text-neutral-500">
            No conversation data available for this period.
          </div>
        ) : (
          questions.map((q) => (
            <div key={q.question} className="py-3 flex items-center justify-between text-xs">
              <span className="text-neutral-200 font-semibold">{q.question}</span>
              <span className="bg-[#1F1F1F] text-[#D4AF37] px-2.5 py-1 rounded-full text-[10px] font-bold">
                {formatNumber(q.count)} times asked
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

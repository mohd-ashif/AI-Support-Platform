import React from "react";
import { Sparkles, Zap, HelpCircle, MessageSquare } from "lucide-react";

export interface SuggestionCard {
  title: string;
  description: string;
  icon_name?: string;
}

interface ChatQuickSuggestionsProps {
  cards?: SuggestionCard[];
  onSelect: (text: string) => void;
  primaryColor?: string;
}

export const ChatQuickSuggestions: React.FC<ChatQuickSuggestionsProps> = ({
  cards = [],
  onSelect,
  primaryColor = "#D4AF37",
}) => {
  const defaultCards: SuggestionCard[] = [
    {
      title: "Track Order Status",
      description: "Check delivery progress and tracking links",
      icon_name: "Sparkles",
    },
    {
      title: "Billing & Subscriptions",
      description: "Invoices, payment methods, and plan changes",
      icon_name: "Zap",
    },
  ];

  const activeCards = cards.length > 0 ? cards : defaultCards;

  return (
    <div className="space-y-2 py-2 animate-in fade-in duration-300">
      <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-neutral-400">
        <Sparkles className="h-3.5 w-3.5" style={{ color: primaryColor }} />
        <span>Suggested Topics</span>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {activeCards.map((card, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(card.title)}
            className="text-left p-3 rounded-xl bg-[#141414] hover:bg-[#1C1C1C] border border-[#242424] hover:border-[#333333] transition-all group shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-bold text-neutral-200 group-hover:text-white transition-colors">
                {card.title}
              </p>
              <p className="text-[10px] text-neutral-500 line-clamp-1">{card.description}</p>
            </div>
            <MessageSquare className="h-3.5 w-3.5 text-neutral-500 group-hover:text-neutral-300 shrink-0 ml-2" />
          </button>
        ))}
      </div>
    </div>
  );
};

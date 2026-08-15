import React, { useState } from "react";
import { Sparkles, Plus, Trash2, Edit3, Check, X } from "lucide-react";

export interface ContentCard {
  title: string;
  description: string;
  icon_name?: string;
}

interface QuickActionsSectionProps {
  cards: ContentCard[];
  onAddCard: () => void;
  onUpdateCard: (index: number, field: keyof ContentCard, value: string) => void;
  onRemoveCard: (index: number) => void;
}

export const QuickActionsSection: React.FC<QuickActionsSectionProps> = ({
  cards = [],
  onAddCard,
  onUpdateCard,
  onRemoveCard,
}) => {
  const maxLimit = 4;
  const currentCount = cards.length;
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  return (
    <section id="quick-actions" className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
        <div className="flex items-center space-x-2.5">
          <Sparkles className="h-5 w-5 text-[#D4AF37]" />
          <div>
            <h2 className="text-sm font-extrabold text-white">Quick Action Suggestions</h2>
            <p className="text-[11px] text-neutral-400">
              Help visitors start conversations faster with pre-suggested topics.
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-[11px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2.5 py-1 rounded-full border border-[#D4AF37]/20">
            {currentCount} / {maxLimit} actions
          </span>
          {currentCount < maxLimit && (
            <button
              type="button"
              onClick={onAddCard}
              className="px-3 py-1.5 rounded-xl bg-[#D4AF37] text-black hover:bg-[#E5C158] text-xs font-bold transition-all flex items-center space-x-1 shadow-md"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Action</span>
            </button>
          )}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="p-8 text-center bg-[#070707] border border-dashed border-[#222222] rounded-xl space-y-2">
          <Sparkles className="h-8 w-8 text-neutral-600 mx-auto" />
          <p className="text-xs font-semibold text-neutral-300">No quick actions yet.</p>
          <p className="text-[11px] text-neutral-500 max-w-sm mx-auto">
            Add up to 4 suggested actions for visitors to click and instantly ask common support questions.
          </p>
          <button
            type="button"
            onClick={onAddCard}
            className="mt-2 inline-flex items-center space-x-1 px-3.5 py-1.5 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] border border-[#333333] text-xs font-bold text-white transition-all"
          >
            <Plus className="h-3.5 w-3.5 text-[#D4AF37]" />
            <span>Add Suggested Action</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {cards.map((card, idx) => {
            const isEditing = editingIndex === idx;

            return (
              <div
                key={idx}
                className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-3.5 space-y-2.5 transition-all hover:border-[#3A3A3A]"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={card.title}
                      onChange={(e) => onUpdateCard(idx, "title", e.target.value)}
                      placeholder="Title (e.g. Track Order Status)"
                      className="w-full bg-[#111111] border border-[#333333] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                    <input
                      type="text"
                      value={card.description}
                      onChange={(e) => onUpdateCard(idx, "description", e.target.value)}
                      placeholder="Description (e.g. Check delivery progress)"
                      className="w-full bg-[#111111] border border-[#333333] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                    />
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingIndex(null)}
                        className="px-3 py-1 rounded-lg bg-[#D4AF37] text-black text-[11px] font-bold flex items-center space-x-1"
                      >
                        <Check className="h-3 w-3" />
                        <span>Done</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                        <Sparkles className="h-3 w-3 text-[#D4AF37]" />
                        <span>{card.title || "Untitled Action"}</span>
                      </h4>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{card.description}</p>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setEditingIndex(idx)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#222222] transition-colors"
                        title="Edit Action"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveCard(idx)}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Delete Action"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

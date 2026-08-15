import React from "react";
import { Sliders, CheckCircle2, Loader2, AlertCircle, RotateCcw } from "lucide-react";

export type SaveStatusType = "idle" | "dirty" | "saving" | "saved" | "error";

interface WidgetSetupHeaderProps {
  saveStatus: SaveStatusType;
  onRetry?: () => void;
}

export const WidgetSetupHeader: React.FC<WidgetSetupHeaderProps> = ({ saveStatus, onRetry }) => {
  return (
    <div className="pb-4 border-b border-[#1F1F1F] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div>
        <div className="flex items-center space-x-2.5">
          <div className="h-8 w-8 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
            <Sliders className="h-4.5 w-4.5" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Floating Chat Widget Customization
          </h1>
        </div>
        <p className="text-xs text-neutral-400 mt-1 pl-10">
          Configure your AI assistant's branding, appearance, behavior, and customer experience.
        </p>
      </div>

      {/* Dynamic Save Status Badge */}
      <div className="flex items-center space-x-2">
        {saveStatus === "saving" && (
          <div className="flex items-center space-x-2 bg-[#111111] border border-[#262626] px-3.5 py-1.5 rounded-full text-xs font-semibold">
            <Loader2 className="h-3.5 w-3.5 text-[#D4AF37] animate-spin" />
            <span className="text-[#D4AF37]">Saving...</span>
          </div>
        )}

        {saveStatus === "saved" && (
          <div className="flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Saved just now</span>
          </div>
        )}

        {saveStatus === "dirty" && (
          <div className="flex items-center space-x-2 bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold text-amber-400">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span>Unsaved changes</span>
          </div>
        )}

        {saveStatus === "error" && (
          <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full text-xs font-semibold text-rose-400">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Unable to save</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="ml-1 text-[10px] bg-rose-500/20 hover:bg-rose-500/30 px-2 py-0.5 rounded font-bold transition-all text-white"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {saveStatus === "idle" && (
          <div className="flex items-center space-x-2 bg-[#111111] border border-[#222222] px-3.5 py-1.5 rounded-full text-xs font-semibold text-neutral-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-neutral-500" />
            <span>All changes saved</span>
          </div>
        )}
      </div>
    </div>
  );
};

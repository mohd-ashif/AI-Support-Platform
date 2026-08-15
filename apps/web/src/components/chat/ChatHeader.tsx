import React, { useState } from "react";
import { AssistantAvatar } from "./AssistantAvatar";
import { Maximize2, Minimize2, RotateCcw, AlertTriangle, X } from "lucide-react";

interface ChatHeaderProps {
  brandName: string;
  tagline?: string;
  primaryColor?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onResetChat?: () => void;
  hasMessages?: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  brandName,
  tagline = "24/7 AI Support Assistant",
  primaryColor = "#D4AF37",
  isExpanded = false,
  onToggleExpand,
  onResetChat,
  hasMessages = false,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleConfirmReset = () => {
    setShowResetConfirm(false);
    if (onResetChat) onResetChat();
  };

  return (
    <>
      <div
        style={{ backgroundColor: primaryColor }}
        className="px-4 py-3 text-black flex items-center justify-between shadow-md shrink-0 border-b border-black/10"
      >
        <div className="flex items-center space-x-3">
          <AssistantAvatar primaryColor="#000000" size="sm" />
          <div>
            <div className="flex items-center space-x-1.5">
              <h2 className="font-extrabold text-sm tracking-tight leading-none text-black">
                {brandName || "SupportAI"}
              </h2>
              <span className="h-2 w-2 rounded-full bg-emerald-950 border border-emerald-400 animate-pulse" />
            </div>
            <p className="text-[10px] font-medium text-black/80 leading-tight mt-0.5">{tagline}</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          {onResetChat && (
            <button
              type="button"
              onClick={() => {
                if (hasMessages) {
                  setShowResetConfirm(true);
                } else {
                  onResetChat();
                }
              }}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-black/10 hover:bg-black/20 text-black transition-all flex items-center space-x-1"
              title="Reset conversation"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset</span>
            </button>
          )}

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg hover:bg-black/15 text-black transition-colors"
              title={isExpanded ? "Minimize preview" : "Expand preview"}
            >
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Reset Confirmation Modal Overlay */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-2xl p-5 max-w-xs w-full space-y-4 shadow-2xl text-center">
            <div className="h-10 w-10 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">Start New Conversation?</h3>
              <p className="text-[11px] text-neutral-400 mt-1">
                Resetting will clear the current transcript from the preview display.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-xl border border-[#333333] text-neutral-300 hover:text-white text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold shadow-md transition-all"
              >
                Start New Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

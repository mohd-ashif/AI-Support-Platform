import React from "react";
import { AssistantAvatar } from "./AssistantAvatar";

interface ChatTypingIndicatorProps {
  primaryColor?: string;
  brandName?: string;
}

export const ChatTypingIndicator: React.FC<ChatTypingIndicatorProps> = ({
  primaryColor = "#D4AF37",
}) => {
  return (
    <div className="flex items-start space-x-2.5 animate-in fade-in duration-200">
      <AssistantAvatar primaryColor={primaryColor} size="sm" />
      <div className="bg-[#181818] border border-[#262626] rounded-2xl rounded-tl-xs px-4 py-3 text-xs text-neutral-300 flex items-center space-x-1.5 shadow-lg shadow-black/20">
        <span className="text-[11px] font-semibold text-neutral-400 mr-1.5">Thinking</span>
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] animate-pulse"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] animate-pulse"
          style={{ animationDelay: "180ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] animate-pulse"
          style={{ animationDelay: "360ms" }}
        />
      </div>
    </div>
  );
};

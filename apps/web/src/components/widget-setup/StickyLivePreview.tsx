import React, { useState } from "react";
import { Compass, Monitor, Smartphone } from "lucide-react";
import { ChatHeader } from "../chat/ChatHeader";
import { ChatMessageItem } from "../chat/ChatMessageItem";
import { ChatTypingIndicator } from "../chat/ChatTypingIndicator";
import { ChatQuickSuggestions } from "../chat/ChatQuickSuggestions";
import { ChatInputArea } from "../chat/ChatInputArea";
import { ContentCard } from "./QuickActionsSection";

interface StickyLivePreviewProps {
  brandName: string;
  tagline: string;
  primaryColor: string;
  greetingMessage: string;
  contentCards: ContentCard[];
  previewMessages: { sender: "user" | "bot"; content: string }[];
  previewSending: boolean;
  previewInputText: string;
  setPreviewInputText: (text: string) => void;
  onSendMessage: (overrideText?: string) => void;
  onResetChat: () => void;
  onStopSending?: () => void;
  chatRef: any;
  showNewMessagePill: boolean;
  onScrollToBottom: () => void;
  onScroll: () => void;
}

export const StickyLivePreview: React.FC<StickyLivePreviewProps> = ({
  brandName,
  tagline,
  primaryColor,
  greetingMessage,
  contentCards,
  previewMessages,
  previewSending,
  previewInputText,
  setPreviewInputText,
  onSendMessage,
  onResetChat,
  onStopSending,
  chatRef,
  showNewMessagePill,
  onScrollToBottom,
  onScroll,
}) => {
  const [deviceFrame, setDeviceFrame] = useState<"desktop" | "mobile">("desktop");
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="sticky top-6 space-y-4">
      {/* Live Preview Header Toolbar */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-2">
          <Compass className="h-4 w-4 text-[#D4AF37]" />
          <span className="text-xs font-bold text-white">Live Preview Studio</span>
        </div>

        {/* Device Frame Toggle */}
        <div className="flex items-center space-x-1 bg-[#070707] p-1 rounded-xl border border-[#222222]">
          <button
            type="button"
            onClick={() => setDeviceFrame("desktop")}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
              deviceFrame === "desktop"
                ? "bg-[#D4AF37] text-black shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
            title="Desktop Frame View"
          >
            <Monitor className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            type="button"
            onClick={() => setDeviceFrame("mobile")}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1 ${
              deviceFrame === "mobile"
                ? "bg-[#D4AF37] text-black shadow-md"
                : "text-neutral-400 hover:text-white"
            }`}
            title="Mobile Frame View"
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>
      </div>

      {/* Simulated Device Frame Window */}
      <div
        className={`bg-[#080808] border border-[#262626] rounded-3xl p-4 shadow-2xl space-y-4 relative flex flex-col justify-between overflow-hidden transition-all duration-300 ${
          deviceFrame === "mobile" ? "max-w-[340px] mx-auto min-h-[560px]" : "min-h-[520px]"
        }`}
      >
        {/* Background Web Content Simulation */}
        <div className="space-y-3 opacity-25 select-none pointer-events-none p-2">
          <div className="h-4 w-32 bg-neutral-700 rounded-md" />
          <div className="h-20 w-full bg-neutral-800/60 rounded-xl" />
          <div className="space-y-1.5">
            <div className="h-3 w-3/4 bg-neutral-700 rounded" />
            <div className="h-3 w-1/2 bg-neutral-700 rounded" />
          </div>
        </div>

        {/* Floating Chat Widget Container */}
        <div
          className={`bg-[#111111] border border-[#262626] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
            isExpanded
              ? "fixed inset-4 md:inset-10 z-50 h-[calc(100vh-80px)] max-w-4xl mx-auto rounded-3xl border-[#333333] shadow-[0_0_50px_rgba(0,0,0,0.8)]"
              : "h-[480px] relative z-10"
          }`}
        >
          {/* Header */}
          <ChatHeader
            brandName={brandName || "SupportAI"}
            tagline={tagline || "24/7 AI Customer Assistant"}
            primaryColor={primaryColor || "#D4AF37"}
            isExpanded={isExpanded}
            onToggleExpand={() => setIsExpanded(!isExpanded)}
            onResetChat={onResetChat}
            hasMessages={previewMessages.length > 0}
          />

          {/* Transcript Body */}
          <div
            ref={chatRef}
            onScroll={onScroll}
            className="p-4 flex-1 space-y-3.5 overflow-y-auto overflow-x-hidden bg-[#0A0A0A] break-words scroll-smooth relative [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-[#0D0D0D] [&::-webkit-scrollbar-thumb]:bg-[#333333] [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-[#D4AF37]"
          >
            <ChatMessageItem
              message={{
                sender: "bot",
                content: greetingMessage || "Hello! How can our AI assistant help you today?",
              }}
              primaryColor={primaryColor || "#D4AF37"}
            />

            {previewMessages.map((msg, idx) => (
              <ChatMessageItem
                key={idx}
                message={msg}
                primaryColor={primaryColor || "#D4AF37"}
                onRegenerate={
                  msg.sender === "bot" && idx === previewMessages.length - 1
                    ? () => onSendMessage(previewMessages[idx - 1]?.content)
                    : undefined
                }
              />
            ))}

            {previewSending && (
              <ChatTypingIndicator
                primaryColor={primaryColor || "#D4AF37"}
                brandName={brandName || "SupportAI"}
              />
            )}

            {previewMessages.length === 0 && (
              <ChatQuickSuggestions
                cards={contentCards}
                onSelect={(title) => onSendMessage(title)}
                primaryColor={primaryColor || "#D4AF37"}
              />
            )}

            {showNewMessagePill && (
              <div className="sticky bottom-2 flex justify-center z-20 pointer-events-none">
                <button
                  type="button"
                  onClick={onScrollToBottom}
                  style={{ backgroundColor: primaryColor || "#D4AF37" }}
                  className="pointer-events-auto px-3 py-1 rounded-full text-black text-[10px] font-extrabold shadow-lg hover:scale-105 transition-all flex items-center space-x-1 animate-bounce"
                >
                  <span>↓ New response</span>
                </button>
              </div>
            )}
          </div>

          {/* Composer Input Area */}
          <ChatInputArea
            inputText={previewInputText}
            setInputText={setPreviewInputText}
            onSend={() => onSendMessage()}
            onStop={onStopSending}
            isGenerating={previewSending}
            primaryColor={primaryColor || "#D4AF37"}
            placeholder="Type a question..."
          />
        </div>
      </div>
    </div>
  );
};

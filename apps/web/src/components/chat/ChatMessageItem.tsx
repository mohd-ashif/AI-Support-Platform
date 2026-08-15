import React, { useState } from "react";
import { AssistantAvatar } from "./AssistantAvatar";
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw } from "lucide-react";

export interface ChatMessage {
  id?: string;
  sender: "user" | "bot";
  content: string;
  timestamp?: string;
}

interface ChatMessageItemProps {
  message: ChatMessage;
  primaryColor?: string;
  onRegenerate?: () => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  primaryColor = "#D4AF37",
  onRegenerate,
}) => {
  const isUser = message.sender === "user";
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopyText = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Structured Markdown Light Parser
  const renderFormattedContent = (text: string) => {
    if (!text) return null;

    // Check for Code Block formatting ```
    if (text.includes("```")) {
      const parts = text.split(/(```[\s\S]*?```)/g);
      return parts.map((part, idx) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const rawCode = part.slice(3, -3).trim();
          const firstLineEnd = rawCode.indexOf("\n");
          const language = firstLineEnd !== -1 ? rawCode.slice(0, firstLineEnd).trim() : "code";
          const codeContent = firstLineEnd !== -1 ? rawCode.slice(firstLineEnd + 1) : rawCode;

          return (
            <div
              key={idx}
              className="my-2.5 rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] overflow-hidden text-[11px] font-mono shadow-inner"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#141414] border-b border-[#222222] text-neutral-400">
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  {language || "code"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(codeContent);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex items-center space-x-1 text-[10px] hover:text-white transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto text-neutral-200 leading-relaxed whitespace-pre">
                <code>{codeContent}</code>
              </pre>
            </div>
          );
        }

        // Paragraph formatting with bold and inline code support
        return (
          <p key={idx} className="whitespace-pre-wrap leading-relaxed">
            {part}
          </p>
        );
      });
    }

    // Standard markdown lines formatting
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Heading ###
      if (line.startsWith("### ")) {
        return (
          <h3 key={idx} className="text-xs font-bold text-white mt-2 mb-1">
            {line.replace("### ", "")}
          </h3>
        );
      }
      // Bullet items • or -
      if (line.trim().startsWith("• ") || line.trim().startsWith("- ")) {
        return (
          <div key={idx} className="flex items-start space-x-2 my-0.5 pl-1">
            <span className="text-[#D4AF37] font-bold select-none">•</span>
            <span className="flex-1">{line.trim().substring(2)}</span>
          </div>
        );
      }
      return (
        <React.Fragment key={idx}>
          {line}
          {idx < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };

  return (
    <div
      className={`group flex items-start space-x-2.5 animate-in fade-in duration-200 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && <AssistantAvatar primaryColor={primaryColor} size="sm" />}

      <div className="flex flex-col space-y-1 max-w-[85%]">
        <div
          className={`p-3.5 rounded-2xl text-xs leading-relaxed shadow-md break-words overflow-hidden transition-all ${
            isUser
              ? "bg-[#1C1C1C] border border-[#2A2A2A] text-white rounded-tr-xs"
              : "bg-[#161616] border border-[#262626] text-neutral-200 rounded-tl-xs"
          }`}
        >
          {renderFormattedContent(message.content)}
        </div>

        {/* Compact Action Bar for Assistant Messages */}
        {!isUser && (
          <div className="flex items-center space-x-2 px-1 text-[10px] text-neutral-500 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleCopyText}
              className="hover:text-neutral-300 flex items-center space-x-1 p-1 rounded hover:bg-[#1E1E1E] transition-all"
              title="Copy response"
            >
              {copied ? (
                <span className="text-emerald-400 font-bold flex items-center space-x-1">
                  <Check className="h-3 w-3" />
                  <span>Copied</span>
                </span>
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </button>

            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="hover:text-neutral-300 flex items-center space-x-1 p-1 rounded hover:bg-[#1E1E1E] transition-all"
                title="Regenerate response"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}

            <div className="flex items-center space-x-1 border-l border-[#262626] pl-2">
              <button
                type="button"
                onClick={() => setFeedback(feedback === "up" ? null : "up")}
                className={`p-1 rounded hover:bg-[#1E1E1E] transition-all ${
                  feedback === "up" ? "text-emerald-400" : "hover:text-neutral-300"
                }`}
                title="Helpful"
              >
                <ThumbsUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setFeedback(feedback === "down" ? null : "down")}
                className={`p-1 rounded hover:bg-[#1E1E1E] transition-all ${
                  feedback === "down" ? "text-rose-400" : "hover:text-neutral-300"
                }`}
                title="Not helpful"
              >
                <ThumbsDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

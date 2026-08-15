import React, { useRef, useEffect } from "react";
import { Send, Square, Loader2 } from "lucide-react";

interface ChatInputAreaProps {
  inputText: string;
  setInputText: (text: string) => void;
  onSend: () => void;
  onStop?: () => void;
  isGenerating?: boolean;
  primaryColor?: string;
  placeholder?: string;
}

export const ChatInputArea: React.FC<ChatInputAreaProps> = ({
  inputText,
  setInputText,
  onSend,
  onStop,
  isGenerating = false,
  primaryColor = "#D4AF37",
  placeholder = "Type your message...",
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() && !isGenerating) {
        onSend();
      }
    }
  };

  return (
    <div className="p-3 bg-[#0D0D0D] border-t border-[#222222] flex items-end space-x-2">
      <div className="flex-1 bg-[#161616] border border-[#2A2A2A] focus-within:border-[#444444] rounded-2xl px-3 py-2 flex items-center transition-all shadow-inner">
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none resize-none max-h-28 overflow-y-auto leading-relaxed"
        />
      </div>

      {isGenerating ? (
        <button
          type="button"
          onClick={onStop}
          style={{ backgroundColor: primaryColor }}
          className="h-9 w-9 rounded-full flex items-center justify-center text-black font-bold shrink-0 hover:opacity-90 active:scale-95 transition-all shadow-md"
          title="Stop Generating"
        >
          <Square className="h-3.5 w-3.5 fill-black" />
        </button>
      ) : (
        <button
          type="button"
          onClick={onSend}
          disabled={!inputText.trim()}
          style={{
            backgroundColor: inputText.trim() ? primaryColor : "#222222",
            color: inputText.trim() ? "#000000" : "#666666",
          }}
          className="h-9 w-9 rounded-full flex items-center justify-center font-bold shrink-0 transition-all shadow-md disabled:cursor-not-allowed active:scale-95"
          title="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

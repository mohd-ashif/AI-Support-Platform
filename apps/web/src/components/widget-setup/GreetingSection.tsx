import React from "react";
import { MessageSquare } from "lucide-react";

interface GreetingSectionProps {
  greetingMessage: string;
  onChange: (value: string) => void;
}

export const GreetingSection: React.FC<GreetingSectionProps> = ({ greetingMessage, onChange }) => {
  const charLimit = 300;
  const currentLen = greetingMessage.length;

  return (
    <section id="greeting" className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-xl">
      <div className="flex items-center space-x-2.5 pb-3 border-b border-[#222222]">
        <MessageSquare className="h-5 w-5 text-[#D4AF37]" />
        <div>
          <h2 className="text-sm font-extrabold text-white">Greeting & Welcome Message</h2>
          <p className="text-[11px] text-neutral-400">
            The opening message displayed to visitors when the AI widget first opens.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-neutral-300">
          <span>Welcome Message Text</span>
          <span className={`text-[10px] font-mono ${currentLen > charLimit ? "text-rose-400" : "text-neutral-500"}`}>
            {currentLen} / {charLimit} characters
          </span>
        </div>
        <textarea
          rows={3}
          value={greetingMessage}
          onChange={(e) => onChange(e.target.value.slice(0, charLimit))}
          placeholder="Hello! How can our AI assistant help you today?"
          className="w-full bg-[#181818] border border-[#2A2A2A] rounded-xl p-3.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37] leading-relaxed resize-none transition-all"
        />
      </div>
    </section>
  );
};

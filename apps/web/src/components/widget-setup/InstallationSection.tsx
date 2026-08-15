import React, { useState } from "react";
import { Code2, Copy, Check } from "lucide-react";

interface InstallationSectionProps {
  embedUuid: string;
}

type PlatformType = "html" | "react" | "nextjs";

export const InstallationSection: React.FC<InstallationSectionProps> = ({ embedUuid }) => {
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformType>("html");
  const [copied, setCopied] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const getSnippet = () => {
    const rawUuid = embedUuid || "YOUR_EMBED_UUID";
    if (selectedPlatform === "html") {
      return `<script 
  src="${API_URL}/widget/v1/embed.js" 
  data-embed-id="${rawUuid}" 
  async defer>
</script>`;
    } else if (selectedPlatform === "react") {
      return `import { useEffect } from "react";

export function SupportWidget() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "${API_URL}/widget/v1/embed.js";
    script.dataset.embedId = "${rawUuid}";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return null;
}`;
    } else {
      return `import Script from "next/script";

export function WidgetScript() {
  return (
    <Script
      src="${API_URL}/widget/v1/embed.js"
      data-embed-id="${rawUuid}"
      strategy="afterInteractive"
    />
  );
}`;
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getSnippet());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="installation" className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-xl">
      <div className="flex items-center space-x-2.5 pb-3 border-b border-[#222222]">
        <Code2 className="h-5 w-5 text-[#D4AF37]" />
        <div>
          <h2 className="text-sm font-extrabold text-white">Embed Script & Installation</h2>
          <p className="text-[11px] text-neutral-400">
            Copy and paste this script tag into your web application to publish your live AI support assistant.
          </p>
        </div>
      </div>

      {/* Platform Selector Tabs */}
      <div className="flex items-center space-x-2 bg-[#070707] p-1 rounded-xl border border-[#222222] w-fit">
        {[
          { id: "html", label: "HTML" },
          { id: "react", label: "React" },
          { id: "nextjs", label: "Next.js" },
        ].map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedPlatform(p.id as PlatformType)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              selectedPlatform === p.id
                ? "bg-[#D4AF37] text-black shadow-md"
                : "text-neutral-400 hover:text-white hover:bg-[#141414]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Code Box */}
      <div className="relative bg-[#050505] border border-[#262626] rounded-xl overflow-hidden shadow-inner font-mono text-xs">
        <div className="flex items-center justify-between px-4 py-2 bg-[#121212] border-b border-[#222222] text-neutral-400">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
            {selectedPlatform} Snippet
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="flex items-center space-x-1.5 text-xs text-[#D4AF37] hover:text-[#E5C158] font-bold transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-4 text-neutral-200 overflow-x-auto whitespace-pre leading-relaxed">
          <code>{getSnippet()}</code>
        </pre>
      </div>
    </section>
  );
};

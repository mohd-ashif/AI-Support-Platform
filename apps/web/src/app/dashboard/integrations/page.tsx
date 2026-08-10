"use client";

import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { apiFetch } from "@/lib/api";
import { Code2, Copy, Check, Terminal, FileCode, Layers, Info } from "lucide-react";

export default function IntegrationsPage() {
  const { selectedWorkspace, workspaces } = useSelector((state: RootState) => state.auth);
  const activeWs = selectedWorkspace || (workspaces && workspaces.length > 0 ? workspaces[0] : null);

  const [activeTab, setActiveTab] = useState<"html" | "react" | "nextjs" | "other">("html");
  const [snippets, setSnippets] = useState<Record<string, any>>({});
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    if (!activeWs?.id) return;

    // STEP 6: Fetch snippets for all platforms on page load
    async function loadSnippets() {
      const platforms: ("html" | "react" | "nextjs" | "other")[] = ["html", "react", "nextjs", "other"];
      const loaded: Record<string, any> = {};

      for (const p of platforms) {
        try {
          const res = await apiFetch(`/integrations/snippet?platform=${p}`, {
            headers: { "X-Workspace-Id": activeWs.id },
          });
          if (res) loaded[p] = res;
        } catch (e) {}
      }
      setSnippets(loaded);
    }

    loadSnippets();
  }, [activeWs?.id]);

  const handleCopyId = () => {
    if (!activeWs?.workspace_uuid) return;
    navigator.clipboard.writeText(activeWs.workspace_uuid);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopySnippet = () => {
    const snippetText = snippets[activeTab]?.snippet_code;
    if (!snippetText) return;
    navigator.clipboard.writeText(snippetText);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const currentSnippet = snippets[activeTab];

  return (
    <div className="p-8 bg-[#050505] min-h-screen text-white space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold flex items-center space-x-2">
          <Code2 className="h-6 w-6 text-[#D4AF37]" />
          <span>Embeddable Widget Integrations</span>
        </h1>
        <p className="text-xs text-neutral-400">
          Embed your custom trained SupportAI widget onto any website, Webflow, Shopify, or React/Next.js web application.
        </p>
      </div>

      {/* Monospace Workspace Public ID Card */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-3 shadow-xl">
        <label className="text-xs font-bold text-neutral-300">Public Workspace Identifier</label>
        <div className="flex space-x-3 items-center">
          <input
            type="text"
            readOnly
            value={activeWs?.workspace_uuid || "Loading Workspace ID..."}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] font-mono text-xs text-[#D4AF37] focus:outline-none select-all"
          />
          <button
            type="button"
            onClick={handleCopyId}
            className="px-4 py-2.5 bg-[#1C1C1C] hover:bg-[#282828] border border-[#2B2B2B] text-neutral-200 font-bold text-xs rounded-xl transition-all flex items-center space-x-2 shrink-0"
          >
            {copiedId ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-neutral-400" />
                <span>Copy ID</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Platform Tabs & Snippet Code Renderer */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-6 shadow-xl">
        <h3 className="text-sm font-bold text-neutral-200">Select Integration Platform</h3>

        {/* Tab Buttons */}
        <div className="flex space-x-2 border-b border-[#222222] pb-3">
          {[
            { key: "html", label: "HTML / Vanilla JS", icon: FileCode },
            { key: "react", label: "React", icon: Code2 },
            { key: "nextjs", label: "Next.js", icon: Terminal },
            { key: "other", label: "Other Stacks (Shopify, Webflow)", icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center space-x-2 transition-all ${
                  isActive
                    ? "bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20"
                    : "bg-[#080808] text-neutral-400 hover:text-white border border-[#1C1C1C]"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Snippet Code Container */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-neutral-300">Integration Code Snippet</span>
            <button
              type="button"
              onClick={handleCopySnippet}
              className="px-3.5 py-1.5 bg-[#1C1C1C] hover:bg-[#282828] border border-[#2B2B2B] text-neutral-200 font-bold text-xs rounded-xl transition-all flex items-center space-x-1.5"
            >
              {copiedSnippet ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied Snippet!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-neutral-400" />
                  <span>Copy Snippet</span>
                </>
              )}
            </button>
          </div>

          <pre className="p-4 bg-[#050505] border border-[#1C1C1C] rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed shadow-inner">
            <code>{currentSnippet?.snippet_code || "Loading snippet code..."}</code>
          </pre>

          {/* Instructions */}
          {currentSnippet?.instructions && (
            <div className="p-4 bg-[#080808] border border-[#1C1C1C] rounded-xl text-xs text-neutral-300 flex items-start space-x-3">
              <Info className="h-4 w-4 text-[#D4AF37] shrink-0 mt-0.5" />
              <div className="whitespace-pre-line leading-relaxed">{currentSnippet.instructions}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

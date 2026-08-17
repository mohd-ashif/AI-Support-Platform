"use client";

import React, { useState } from "react";
import {
  Code2,
  Loader2,
  X,
  FileCode2,
  Sparkles,
  ExternalLink,
  Github,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";

interface CodeExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  filePath?: string;
  repoId?: string;
  workspaceId?: string;
}

export function CodeExplainerModal({
  isOpen,
  onClose,
  filePath: initialFilePath = "",
  repoId,
  workspaceId,
}: CodeExplainerModalProps) {
  const toast = useToast();
  const [filePath, setFilePath] = useState(initialFilePath);
  const [isLoading, setIsLoading] = useState(false);
  const [explanationResult, setExplanationResult] = useState<any>(null);

  if (!isOpen) return null;

  const handleExplain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filePath.trim() || isLoading) return;

    setIsLoading(true);
    setExplanationResult(null);

    try {
      const headers: Record<string, string> = {};
      if (workspaceId) headers["X-Workspace-Id"] = workspaceId;

      const res = await apiFetch<any>("/integrations/github/explain-file", {
        method: "POST",
        body: JSON.stringify({ file_path: filePath.trim(), repo_id: repoId }),
        headers,
      });

      setExplanationResult(res);
      toast.success("AI Code explanation generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to explain code file.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0D0D0D] border border-[#222222] rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#1A1A1A] flex items-center justify-between bg-[#111111]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">AI Developer Code Explainer</h2>
              <p className="text-xs text-neutral-400">
                Analyze target repository files to understand purpose, dependencies, flow, and key functions.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-[#1C1C1C] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <form onSubmit={handleExplain} className="flex items-center space-x-3">
            <div className="relative flex-1">
              <FileCode2 className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Enter file path (e.g. src/auth/auth.service.ts or docs/authentication.md)..."
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !filePath.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs hover:brightness-110 disabled:opacity-50 flex items-center space-x-2 shrink-0 shadow-lg shadow-[#D4AF37]/10"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-black" />
              ) : (
                <Sparkles className="h-4 w-4 text-black" />
              )}
              <span>Explain with AI</span>
            </button>
          </form>

          {/* Explanation Output Container */}
          {explanationResult && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="p-5 rounded-2xl bg-[#050505] border border-[#1F1F1F] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]">
                  <div className="flex items-center space-x-2">
                    <Code2 className="h-4 w-4 text-[#D4AF37]" />
                    <span className="text-xs font-extrabold text-white font-mono">
                      {explanationResult.file_path}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1C1C1C] text-neutral-400 border border-[#2B2B2B]">
                    {explanationResult.chunks_count} Chunks Analyzed
                  </span>
                </div>

                <div className="text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap font-sans">
                  {explanationResult.explanation_markdown}
                </div>
              </div>

              {/* Citations list */}
              {explanationResult.citations && explanationResult.citations.length > 0 && (
                <div className="p-4 rounded-2xl bg-[#080808] border border-[#1A1A1A] space-y-2">
                  <span className="text-[10px] uppercase font-extrabold text-neutral-400 flex items-center space-x-1">
                    <Github className="h-3 w-3 text-[#D4AF37]" />
                    <span>Verified GitHub Sources ({explanationResult.citations.length})</span>
                  </span>

                  <div className="space-y-1">
                    {explanationResult.citations.map((c: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded-xl bg-[#050505] border border-[#1F1F1F] text-[11px]"
                      >
                        <span className="font-mono text-white font-bold truncate">
                          {c.filePath || c.documentName}
                          {c.lineStart && ` (L${c.lineStart}-L${c.lineEnd})`}
                        </span>

                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded-lg bg-[#1F1F1F] hover:bg-[#D4AF37] text-neutral-300 hover:text-black transition-all text-[10px] font-bold shrink-0 flex items-center space-x-1"
                          >
                            <span>GitHub</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

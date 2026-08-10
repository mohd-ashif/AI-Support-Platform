"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { apiFetch } from "@/lib/api";
import { Globe, Plus, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

export default function WebContentSourcesPage() {
  const { selectedWorkspace, workspaces } = useSelector((state: RootState) => state.auth);
  const activeWs = selectedWorkspace || (workspaces && workspaces.length > 0 ? workspaces[0] : null);

  const [sources, setSources] = useState<any[]>([]);
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const fetchSources = async () => {
    if (!activeWs?.id) return;
    try {
      const data = await apiFetch("/sources/web", {
        headers: { "X-Workspace-Id": activeWs.id },
      });
      setSources(data || []);
    } catch (err: any) {
      // Ignore background poll errors
    }
  };

  useEffect(() => {
    fetchSources();
  }, [activeWs?.id]);

  // Polling: every 3s ONLY while in-progress rows exist
  useEffect(() => {
    const hasInProgress = sources.some((s) => s.status === "pending" || s.status === "crawling");
    if (!hasInProgress) return;

    const timer = setInterval(() => {
      fetchSources();
    }, 3000);

    return () => clearInterval(timer);
  }, [sources, activeWs?.id]);

  const handleAddWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.trim()) return;

    setSubmitting(true);
    try {
      await apiFetch("/sources/web", {
        method: "POST",
        headers: { "X-Workspace-Id": activeWs?.id },
        body: JSON.stringify({ url: url.trim() }),
      });
      setUrl("");
      await fetchSources();
    } catch (err: any) {
      setError(err.message || "Failed to add website source.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecrawl = async (sourceId: string) => {
    try {
      await apiFetch(`/sources/web/${sourceId}/recrawl`, {
        method: "POST",
        headers: { "X-Workspace-Id": activeWs?.id },
      });
      await fetchSources();
    } catch (err: any) {
      setError(err.message || "Failed to trigger recrawl.");
    }
  };

  const handleDelete = async (sourceId: string) => {
    try {
      await apiFetch(`/sources/web/${sourceId}`, {
        method: "DELETE",
        headers: { "X-Workspace-Id": activeWs?.id },
      });
      setDeleteTargetId(null);
      await fetchSources();
    } catch (err: any) {
      setError(err.message || "Failed to delete web source.");
    }
  };

  return (
    <div className="p-8 space-[#050505] min-h-screen text-white space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold flex items-center space-x-2">
          <Globe className="h-6 w-6 text-[#D4AF37]" />
          <span>Web Content Knowledge Base</span>
        </h1>
        <p className="text-xs text-neutral-400">
          Crawl and index websites to train your AI support agent with SSRF protection & automatic domain scoping.
        </p>
      </div>

      {/* Add Website Card */}
      <form
        onSubmit={handleAddWebsite}
        className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-xl"
      >
        <h3 className="text-sm font-bold text-neutral-200">Crawl New Website Domain</h3>
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex space-x-3">
          <input
            type="text"
            required
            placeholder="https://docs.acme.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] focus:border-[#D4AF37] text-xs text-white placeholder-neutral-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 bg-[#D4AF37] text-black font-extrabold text-xs rounded-xl hover:brightness-110 transition-all flex items-center space-x-2 shrink-0"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-black" />
                <span>Crawling...</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 text-black" />
                <span>Add Website</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Sources Table */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-neutral-300">
          <thead className="bg-[#161616] text-neutral-400 font-bold uppercase text-[10px] border-b border-[#222222]">
            <tr>
              <th className="p-4">Target Website URL</th>
              <th className="p-4">Status</th>
              <th className="p-4">Pages Crawled</th>
              <th className="p-4">Last Crawled</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F1F1F]">
            {sources.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-neutral-500">
                  No website sources indexed yet. Enter a domain URL above to begin.
                </td>
              </tr>
            ) : (
              sources.map((src) => {
                const isReady = src.status === "ready";
                const isFailed = src.status === "failed";
                const isPending = src.status === "pending" || src.status === "crawling";

                return (
                  <tr key={src.id} className="hover:bg-[#161616]/50 transition-colors">
                    <td className="p-4 font-semibold text-white truncate max-w-xs">{src.url}</td>
                    <td className="p-4">
                      {isReady && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] flex items-center space-x-1.5 w-fit">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Ready</span>
                        </span>
                      )}
                      {isFailed && (
                        <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-[10px] flex items-center space-x-1.5 w-fit" title={src.error_message}>
                          <XCircle className="h-3 w-3" />
                          <span>Failed</span>
                        </span>
                      )}
                      {isPending && (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[10px] flex items-center space-x-1.5 w-fit">
                          <Clock className="h-3 w-3 animate-spin" />
                          <span className="capitalize">{src.status}...</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-mono">{src.page_count} pages</td>
                    <td className="p-4 text-neutral-400">
                      {src.last_crawled_at ? new Date(src.last_crawled_at).toLocaleDateString() : "Pending"}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button
                        onClick={() => handleRecrawl(src.id)}
                        className="p-1.5 rounded-lg bg-[#1C1C1C] hover:bg-[#282828] text-neutral-300 transition-colors"
                        title="Recrawl Source"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTargetId(src.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        title="Delete Source"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 max-w-sm w-full space-y-4 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-white">Delete Website Source?</h4>
              <p className="text-xs text-neutral-400">
                This will permanently remove the web index and vector embeddings from your AI agent's knowledge base.
              </p>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2 rounded-xl bg-[#1C1C1C] text-neutral-300 font-bold text-xs hover:bg-[#252525]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTargetId)}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white font-extrabold text-xs hover:bg-red-600"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

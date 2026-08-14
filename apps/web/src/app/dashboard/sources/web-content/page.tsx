"use client";

import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { apiFetch } from "@/lib/api";
import {
  setWebSourcesLoading,
  setWebSourcesSuccess,
  setWebSourcesError,
  addWebSource,
  removeWebSource,
  updateWebSource,
} from "@/store/slices/sourcesSlice";
import { Globe, Plus, RefreshCw, Trash2, AlertTriangle, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";

export default function WebContentSourcesPage() {
  const dispatch = useDispatch();
  const { selectedWorkspace, workspaces } = useSelector((state: RootState) => state.auth);
  const webState = useSelector((state: RootState) => state.sources.web);
  const activeWs = selectedWorkspace || (workspaces && workspaces.length > 0 ? workspaces[0] : null);

  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const fetchSources = async (force: boolean = false) => {
    if (!activeWs?.id) return;
    // Skip refetch on mount if Redux already contains valid success data and force is false
    if (!force && webState.status === "success" && webState.items.length > 0) {
      return;
    }

    try {
      if (webState.status === "idle") {
        dispatch(setWebSourcesLoading());
      }
      const data = await apiFetch("/sources/web", {
        headers: { "X-Workspace-Id": activeWs.id },
      });
      dispatch(setWebSourcesSuccess({ items: data || [] }));
    } catch (err: any) {
      dispatch(setWebSourcesError(err.message || "Failed to load web sources"));
    }
  };

  useEffect(() => {
    fetchSources(false);
  }, [activeWs?.id]);

  // Polling: every 3s ONLY while in-progress rows exist
  useEffect(() => {
    const hasInProgress = webState.items.some((s) => s.status === "pending" || s.status === "crawling");
    if (!hasInProgress) return;

    const timer = setInterval(() => {
      fetchSources(true);
    }, 3000);

    return () => clearInterval(timer);
  }, [webState.items, activeWs?.id]);

  const handleAddWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.trim()) return;

    setSubmitting(true);
    try {
      const createdSource = await apiFetch("/sources/web", {
        method: "POST",
        headers: { "X-Workspace-Id": activeWs?.id },
        body: JSON.stringify({ url: url.trim() }),
      });
      setUrl("");
      // Optimistically update Redux state directly without full refetch
      dispatch(addWebSource(createdSource));
    } catch (err: any) {
      setError(err.message || "Failed to add website source.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecrawl = async (sourceId: string) => {
    try {
      const updated = await apiFetch(`/sources/web/${sourceId}/recrawl`, {
        method: "POST",
        headers: { "X-Workspace-Id": activeWs?.id },
      });
      dispatch(updateWebSource(updated));
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
      // Optimistically update Redux state directly without full refetch
      dispatch(removeWebSource(sourceId));
    } catch (err: any) {
      setError(err.message || "Failed to delete web source.");
    }
  };

  const sources = webState.items;

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
            placeholder="https://docs.example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 bg-[#1A1A1A] border border-[#333333] rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37] transition-all"
          />
          <button
            type="submit"
            disabled={submitting || !url.trim()}
            className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b89628] disabled:opacity-50 text-black font-semibold text-sm rounded-xl transition-all flex items-center space-x-2 shrink-0 shadow-lg shadow-[#D4AF37]/10"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>{submitting ? "Submitting..." : "Add Website"}</span>
          </button>
        </div>
      </form>

      {/* Sources List Table */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-200">Indexed Web Domains ({sources.length})</h3>
          <button
            onClick={() => fetchSources(true)}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
            title="Refresh List"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {webState.status === "loading" && sources.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
            <p className="text-xs">Loading web sources from cache / API...</p>
          </div>
        ) : sources.length === 0 ? (
          <div className="py-12 text-center text-neutral-500 space-y-2">
            <Globe className="h-8 w-8 mx-auto text-neutral-600 stroke-[1.5]" />
            <p className="text-xs">No website sources indexed yet. Add your documentation or homepage above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#222222] text-neutral-400">
                  <th className="pb-3 font-semibold">Target URL</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Pages Indexed</th>
                  <th className="pb-3 font-semibold">Last Crawled</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {sources.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 font-medium text-white max-w-xs truncate">{s.url}</td>
                    <td className="py-4">
                      {s.status === "completed" && (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Active</span>
                        </span>
                      )}
                      {(s.status === "pending" || s.status === "crawling") && (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="h-3 w-3 animate-spin" />
                          <span>{s.status === "pending" ? "Queued" : "Crawling..."}</span>
                        </span>
                      )}
                      {s.status === "failed" && (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] bg-red-500/10 text-red-400 border border-red-500/20" title={s.error_message || ""}>
                          <XCircle className="h-3 w-3" />
                          <span>Failed</span>
                        </span>
                      )}
                    </td>
                    <td className="py-4 text-neutral-300">{s.page_count || 0} pages</td>
                    <td className="py-4 text-neutral-400">
                      {s.last_crawled_at ? new Date(s.last_crawled_at).toLocaleString() : "Never"}
                    </td>
                    <td className="py-4 text-right space-x-2">
                      <button
                        onClick={() => handleRecrawl(s.id)}
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title="Recrawl Source"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTargetId(s.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title="Delete Source"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span>Delete Web Source</span>
            </h3>
            <p className="text-xs text-neutral-400">
              Are you sure you want to delete this web source? All associate knowledge vectors will be permanently removed.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-xl text-neutral-300 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteTargetId)}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-xs font-semibold rounded-xl text-white transition-all shadow-lg shadow-red-600/20"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

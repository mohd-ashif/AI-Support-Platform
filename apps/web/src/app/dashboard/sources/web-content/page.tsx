"use client";

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  useWebSources,
  useCrawlWebSourceMutation,
  useRecrawlWebSourceMutation,
  useDeleteWebSourceMutation,
} from "@/hooks/queries/useSourcesQueries";
import { useToast } from "@/components/ui/ToastProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormField } from "@/components/ui/FormField";
import { formatDateTime } from "@/lib/utils/format";
import { Globe, Plus, RefreshCw, Trash2, AlertTriangle, Loader2 } from "lucide-react";

export default function WebContentSourcesPage() {
  const toast = useToast();
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const workspaces = useSelector((state: RootState) => state.auth.workspaces || []);
  const activeWs = selectedWorkspace || (workspaces.length > 0 ? workspaces[0] : null);
  const activeWsId = activeWs?.id;

  const { data: sources = [], isLoading, isError, refetch } = useWebSources(activeWsId);
  const crawlMutation = useCrawlWebSourceMutation(activeWsId);
  const recrawlMutation = useRecrawlWebSourceMutation(activeWsId);
  const deleteMutation = useDeleteWebSourceMutation(activeWsId);

  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const handleAddWebsite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!url.trim() || crawlMutation.isPending) return;

    try {
      await crawlMutation.mutateAsync(url.trim());
      setUrl("");
      toast.success("Website added and crawl initiated!");
    } catch (err: any) {
      const msg = err.message || "Failed to add website source.";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleRecrawl = async (sourceId: string) => {
    try {
      await recrawlMutation.mutateAsync(sourceId);
      toast.success("Recrawl triggered for web source.");
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger recrawl.");
    }
  };

  const handleDelete = async (sourceId: string) => {
    try {
      await deleteMutation.mutateAsync(sourceId);
      setDeleteTargetId(null);
      toast.success("Web source deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete web source.");
    }
  };

  return (
    <div className="p-8 space-[#050505] min-h-screen text-white space-y-8 animate-in fade-in duration-300">
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
        <FormField label="Crawl New Website Domain" error={error}>
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
              disabled={crawlMutation.isPending || !url.trim()}
              className="px-5 py-2.5 bg-[#D4AF37] hover:bg-[#b89628] disabled:opacity-50 text-black font-semibold text-sm rounded-xl transition-all flex items-center space-x-2 shrink-0 shadow-lg shadow-[#D4AF37]/10"
            >
              {crawlMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span>{crawlMutation.isPending ? "Submitting..." : "Add Website"}</span>
            </button>
          </div>
        </FormField>
      </form>

      {/* Sources List Table */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-neutral-200">Indexed Web Domains ({sources.length})</h3>
          <button
            onClick={() => refetch()}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/5 transition-all"
            title="Refresh List"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <table className="w-full text-left text-xs">
            <TableSkeleton columns={5} rows={3} />
          </table>
        ) : sources.length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No website sources indexed yet"
            description="Add your documentation domain or homepage URL above to train your AI agent."
          />
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
                      <StatusBadge status={s.status} title={s.error_message || undefined} />
                    </td>
                    <td className="py-4 text-neutral-300">{s.page_count || 0} pages</td>
                    <td className="py-4 text-neutral-400">{formatDateTime(s.last_crawled_at)}</td>
                    <td className="py-4 text-right space-x-2">
                      <button
                        onClick={() => handleRecrawl(s.id)}
                        disabled={recrawlMutation.isPending}
                        className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-all disabled:opacity-50"
                        title="Recrawl Source"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTargetId(s.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
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
      <Modal
        isOpen={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        title="Delete Web Source"
        description="Are you sure you want to delete this web source? All associated knowledge vectors will be permanently removed."
        icon={AlertTriangle}
        footer={
          <>
            <button
              onClick={() => setDeleteTargetId(null)}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-xl text-neutral-300 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteTargetId && handleDelete(deleteTargetId)}
              disabled={deleteMutation.isPending}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-xs font-semibold rounded-xl text-white transition-all shadow-lg shadow-red-600/20 disabled:opacity-50"
            >
              Delete
            </button>
          </>
        }
      />
    </div>
  );
}

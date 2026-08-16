"use client";

import React, { useState, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  useWebSources,
  useFileSources,
  useCrawlWebSourceMutation,
  useUploadFileSourceMutation,
  useDeleteWebSourceMutation,
  useDeleteFileSourceMutation,
} from "@/hooks/queries/useSourcesQueries";
import { useToast } from "@/components/ui/ToastProvider";
import { formatBytes } from "@/lib/utils/format";
import { BookOpen, Globe, FileText, Upload, Sparkles, CheckCircle2, Trash2, Loader2, RefreshCw } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Permissions } from "@/lib/permissions";

export default function KnowledgeBasePage() {
  const toast = useToast();
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const activeWsId = selectedWorkspace?.id;

  const { data: webSources = [], isLoading: loadingWeb, refetch: refetchWeb } = useWebSources(activeWsId);
  const { data: fileSources = [], isLoading: loadingFiles, refetch: refetchFiles } = useFileSources(activeWsId);

  const crawlMutation = useCrawlWebSourceMutation(activeWsId);
  const uploadMutation = useUploadFileSourceMutation(activeWsId);
  const deleteWebMutation = useDeleteWebSourceMutation(activeWsId);
  const deleteFileMutation = useDeleteFileSourceMutation(activeWsId);

  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loading = loadingWeb || loadingFiles;

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || crawlMutation.isPending) return;

    try {
      await crawlMutation.mutateAsync(urlInput.trim());
      setUrlInput("");
      toast.success("Website crawling & vector indexing started!");
    } catch (err: any) {
      toast.error(err.message || "Failed to start website crawl.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      await uploadMutation.mutateAsync(files[0]);
      toast.success(`Successfully uploaded and indexed ${files[0].name}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file document.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteSource = async (id: string, type: "web" | "file") => {
    try {
      if (type === "web") {
        await deleteWebMutation.mutateAsync(id);
      } else {
        await deleteFileMutation.mutateAsync(id);
      }
      toast.success("Knowledge source deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete source.");
    }
  };

  const allSources = [
    ...webSources.map((s) => ({ ...s, type: "web" as const, name: s.url, info: `${s.page_count || 0} pages indexed` })),
    ...fileSources.map((s) => ({ ...s, type: "file" as const, name: s.filename, info: formatBytes(s.file_size_bytes || 0) })),
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="pb-4 border-b border-[#1F1F1F]">
        <div className="flex items-center space-x-2">
          <BookOpen className="h-6 w-6 text-[#D4AF37]" />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">AI Knowledge Base & RAG Training</h1>
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          Crawl website documentation and upload PDF files to generate vector embeddings in Neon PostgreSQL.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Website Crawler Card */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <Globe className="h-5 w-5 text-[#D4AF37]" />
            <h3 className="text-sm font-bold text-white">Crawl Website URL</h3>
          </div>
          <p className="text-xs text-neutral-400">
            Automatically crawl all pages from your company domain to index product FAQs and help articles.
          </p>

          <form onSubmit={handleStartCrawl} className="space-y-3">
            <input
              type="url"
              placeholder="https://docs.yourcompany.com"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
            />
            <button
              type="submit"
              disabled={crawlMutation.isPending || !urlInput.trim()}
              className="w-full py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
            >
              {crawlMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-black" />
                  <span>Crawling & Indexing Pages...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Start Crawl & Vectorization</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* File Upload Card */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-[#D4AF37]" />
            <h3 className="text-sm font-bold text-white">Upload Knowledge Documents</h3>
          </div>
          <p className="text-xs text-neutral-400">
            Upload PDF, DOCX, or TXT documentation to extract embeddings directly into vector storage.
          </p>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".pdf,.csv,.txt,.docx"
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#222222] hover:border-[#D4AF37]/50 rounded-xl p-6 text-center cursor-pointer transition-colors space-y-2 bg-[#050505]"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-6 w-6 text-[#D4AF37] mx-auto animate-spin" />
            ) : (
              <Upload className="h-6 w-6 text-[#D4AF37] mx-auto" />
            )}
            <p className="text-xs text-neutral-300 font-semibold">
              {uploadMutation.isPending ? "Extracting Text & Generating Embeddings..." : "Click to select PDF or text files"}
            </p>
            <p className="text-[10px] text-neutral-500">Supports PDF, CSV, TXT files up to 25MB</p>
          </div>
        </div>
      </div>

      {/* Indexed Sources Table */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Active Knowledge Sources</h3>
          <button
            type="button"
            onClick={() => {
              refetchWeb();
              refetchFiles();
            }}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#1A1A1A] transition-colors"
            title="Refresh List"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-neutral-400 border-b border-[#1F1F1F]">
                <th className="pb-3 font-bold">Source Name / URL</th>
                <th className="pb-3 font-bold">Type</th>
                <th className="pb-3 font-bold">Status</th>
                <th className="pb-3 font-bold">Info</th>
                <th className="pb-3 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-neutral-400">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
                      <span>Loading knowledge sources...</span>
                    </div>
                  </td>
                </tr>
              ) : allSources.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-neutral-500">
                    No knowledge sources indexed yet. Add a website URL or upload a file above.
                  </td>
                </tr>
              ) : (
                allSources.map((s) => (
                  <tr key={s.id} className="hover:bg-[#141414] transition-colors">
                    <td className="py-3 font-bold text-white max-w-xs truncate">{s.name}</td>
                    <td className="py-3 uppercase text-[10px] text-[#D4AF37] font-bold">{s.type}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${
                          s.status === "completed" || s.status === "indexed" || s.status === "ready"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 text-neutral-400">{s.info}</td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteSource(s.id, s.type)}
                        disabled={deleteWebMutation.isPending || deleteFileMutation.isPending}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Delete Source & Vectors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

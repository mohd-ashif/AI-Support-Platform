"use client";

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  useFileSources,
  useWebSources,
  useUploadFileSourceMutation,
  useDeleteFileSourceMutation,
} from "@/hooks/queries/useSourcesQueries";
import { useToast } from "@/components/ui/ToastProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatBytes } from "@/lib/utils/format";
import { FileText, Upload, Trash2, AlertCircle, File, HelpCircle, Loader2 } from "lucide-react";

export default function DataImporterPage() {
  const toast = useToast();
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const workspaces = useSelector((state: RootState) => state.auth.workspaces || []);
  const activeWs = selectedWorkspace || (workspaces.length > 0 ? workspaces[0] : null);
  const activeWsId = activeWs?.id;

  const { data: files = [], isLoading } = useFileSources(activeWsId);
  const { data: webSources = [] } = useWebSources(activeWsId);

  const uploadMutation = useUploadFileSourceMutation(activeWsId);
  const deleteMutation = useDeleteFileSourceMutation(activeWsId);

  const [error, setError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const planLimit = activeWs?.plan_id === "plan_pro" ? 20 : activeWs?.plan_id === "plan_business" ? "Unlimited" : 5;

  const handleFileUpload = async (selectedFile: File) => {
    setError(null);

    if (selectedFile.size > 25 * 1024 * 1024) {
      const msg = "File size exceeds 25MB limit.";
      setError(msg);
      toast.error(msg);
      return;
    }

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "csv", "txt", "docx"].includes(ext || "")) {
      const msg = "Unsupported file format. Please upload .pdf, .csv, .docx, or .txt files.";
      setError(msg);
      toast.error(msg);
      return;
    }

    try {
      await uploadMutation.mutateAsync(selectedFile);
      toast.success(`Successfully uploaded and indexed ${selectedFile.name}`);
    } catch (err: any) {
      const msg = err.message || "Failed to upload document file.";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleDelete = async (sourceId: string) => {
    try {
      await deleteMutation.mutateAsync(sourceId);
      setDeleteTargetId(null);
      toast.success("Document file source deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete file source.");
    }
  };

  const totalUsed = files.length + webSources.length;

  return (
    <div className="p-8 bg-[#050505] min-h-screen text-white space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold flex items-center space-x-2">
          <FileText className="h-6 w-6 text-[#D4AF37]" />
          <span>Data Importer</span>
        </h1>
        <p className="text-xs text-neutral-400">
          Upload custom documents to train your support agent with exact company knowledge.
        </p>
      </div>

      {/* Upload & Info Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Card: Drag & Drop */}
        <div className="lg:col-span-2 bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-xl flex flex-col justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-neutral-200">Import files</h3>
            <p className="text-xs text-neutral-400">
              Drag and drop your document file here to automatically extract vector embeddings.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <label className="border-2 border-dashed border-[#262626] hover:border-[#D4AF37] transition-all rounded-2xl p-8 text-center cursor-pointer bg-[#080808] flex flex-col items-center justify-center space-y-3 group">
            <input
              type="file"
              accept=".pdf,.csv,.txt,.docx"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
            />
            {uploadMutation.isPending ? (
              <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" />
            ) : (
              <Upload className="h-10 w-10 text-neutral-500 group-hover:text-[#D4AF37] transition-colors" />
            )}
            <div className="space-y-1">
              <p className="text-xs font-bold text-neutral-200">
                {uploadMutation.isPending ? "Extracting Text & Generating Embeddings..." : "Drag and drop document file here"}
              </p>
              <p className="text-[11px] text-neutral-500">Accepted file types: .pdf, .csv, .txt, .docx • Max 25MB</p>
            </div>
          </label>
        </div>

        {/* Right Card: Info Panel */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-neutral-200 flex items-center space-x-2">
            <HelpCircle className="h-4 w-4 text-[#D4AF37]" />
            <span>What file types are supported?</span>
          </h3>

          <div className="space-y-3 text-xs text-neutral-400 leading-relaxed">
            <p>
              SupportAI parses layout structures from **PDFs**, converts row values from **CSV files**, and indexes plain text documents (**TXT**).
            </p>
            <p>
              All extracted document text is split into 500-token chunks with 50-token overlap and vectorized using OpenAI's state-of-the-art embedding model.
            </p>
          </div>
        </div>
      </div>

      {/* Manage Imported Data Table */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-extrabold text-white">Manage Imported Data</h3>
          <span className="px-3 py-1 bg-[#161616] border border-[#262626] rounded-full text-xs font-bold text-[#D4AF37]">
            {totalUsed} / {planLimit} Documents Used
          </span>
        </div>

        <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs text-neutral-300">
            <thead className="bg-[#161616] text-neutral-400 font-bold uppercase text-[10px] border-b border-[#222222]">
              <tr>
                <th className="p-4">Document Title</th>
                <th className="p-4">File Size</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            {isLoading && files.length === 0 ? (
              <TableSkeleton columns={4} rows={3} />
            ) : files.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      icon={FileText}
                      title="No document files imported yet"
                      description="Drag and drop a PDF, CSV, or TXT file above to train your AI agent."
                    />
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody className="divide-y divide-[#1F1F1F]">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-[#161616]/50 transition-colors">
                    <td className="p-4 font-semibold text-white flex items-center space-x-2">
                      <File className="h-4 w-4 text-[#D4AF37]" />
                      <span className="truncate max-w-xs">{file.filename}</span>
                    </td>
                    <td className="p-4 font-mono text-neutral-400">{formatBytes(file.file_size_bytes)}</td>
                    <td className="p-4">
                      <StatusBadge status={file.status} title={file.error_message || undefined} />
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => setDeleteTargetId(file.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-50"
                        title="Delete File"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={Boolean(deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        title="Delete Document Source?"
        description="This will permanently remove the file source and its knowledge chunks from your agent's memory."
        icon={AlertCircle}
        footer={
          <>
            <button
              onClick={() => setDeleteTargetId(null)}
              className="flex-1 py-2 rounded-xl bg-[#1C1C1C] text-neutral-300 font-bold text-xs hover:bg-[#252525]"
            >
              Cancel
            </button>
            <button
              onClick={() => deleteTargetId && handleDelete(deleteTargetId)}
              disabled={deleteMutation.isPending}
              className="flex-1 py-2 rounded-xl bg-red-500 text-white font-extrabold text-xs hover:bg-red-600 disabled:opacity-50"
            >
              Confirm Delete
            </button>
          </>
        }
      />
    </div>
  );
}

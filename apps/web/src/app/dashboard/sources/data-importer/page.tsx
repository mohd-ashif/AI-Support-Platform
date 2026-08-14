"use client";

import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { apiFetch } from "@/lib/api";
import {
  setFileSourcesLoading,
  setFileSourcesSuccess,
  setFileSourcesError,
  addFileSource,
  removeFileSource,
} from "@/store/slices/sourcesSlice";
import { FileText, Upload, Trash2, CheckCircle2, Clock, XCircle, AlertCircle, File, HelpCircle, Loader2 } from "lucide-react";

export default function DataImporterPage() {
  const dispatch = useDispatch();
  const { selectedWorkspace, workspaces } = useSelector((state: RootState) => state.auth);
  const fileState = useSelector((state: RootState) => state.sources.files);
  const webState = useSelector((state: RootState) => state.sources.web);
  const activeWs = selectedWorkspace || (workspaces && workspaces.length > 0 ? workspaces[0] : null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const planLimit = activeWs?.plan_id === "plan_pro" ? 20 : activeWs?.plan_id === "plan_business" ? "Unlimited" : 5;

  const fetchSources = async (force: boolean = false) => {
    if (!activeWs?.id) return;

    if (!force && fileState.status === "success" && fileState.items.length > 0) {
      return;
    }

    try {
      if (fileState.status === "idle") {
        dispatch(setFileSourcesLoading());
      }
      const fileData = await apiFetch("/sources/files", {
        headers: { "X-Workspace-Id": activeWs.id },
      });
      dispatch(setFileSourcesSuccess({ items: fileData || [] }));
    } catch (err: any) {
      dispatch(setFileSourcesError(err.message || "Failed to fetch file sources"));
    }
  };

  useEffect(() => {
    fetchSources(false);
  }, [activeWs?.id]);

  useEffect(() => {
    const hasInProgress = fileState.items.some((f) => f.status === "pending" || f.status === "processing");
    if (!hasInProgress) return;

    const timer = setInterval(() => {
      fetchSources(true);
    }, 3000);

    return () => clearInterval(timer);
  }, [fileState.items, activeWs?.id]);

  const handleFileUpload = async (selectedFile: File) => {
    setError(null);

    // Client-side defense-in-depth checks
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File size exceeds 5MB limit.");
      return;
    }

    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "csv", "txt"].includes(ext || "")) {
      setError("Unsupported file format. Please upload .pdf, .csv, or .txt files.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const createdFile = await apiFetch("/sources/files", {
        method: "POST",
        headers: { "X-Workspace-Id": activeWs?.id },
        body: formData,
      });

      // Optimistically update Redux state directly
      dispatch(addFileSource(createdFile));
    } catch (err: any) {
      setError(err.message || "Failed to upload document file.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (sourceId: string) => {
    try {
      await apiFetch(`/sources/files/${sourceId}`, {
        method: "DELETE",
        headers: { "X-Workspace-Id": activeWs?.id },
      });
      setDeleteTargetId(null);
      // Optimistically update Redux state directly
      dispatch(removeFileSource(sourceId));
    } catch (err: any) {
      setError(err.message || "Failed to delete file source.");
    }
  };

  const files = fileState.items;
  const webCount = webState.items.length;
  const totalUsed = files.length + webCount;

  return (
    <div className="p-8 bg-[#050505] min-h-screen text-white space-y-8">
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
              accept=".pdf,.csv,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
              }}
            />
            {uploading ? (
              <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" />
            ) : (
              <Upload className="h-10 w-10 text-neutral-500 group-hover:text-[#D4AF37] transition-colors" />
            )}
            <div className="space-y-1">
              <p className="text-xs font-bold text-neutral-200">Drag and drop document file here</p>
              <p className="text-[11px] text-neutral-500">Accepted file types: .pdf, .csv, .txt • Max 5MB</p>
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
            <tbody className="divide-y divide-[#1F1F1F]">
              {fileState.status === "loading" && files.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-neutral-500">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#D4AF37] mb-2" />
                    Loading document files from cache / API...
                  </td>
                </tr>
              ) : files.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-neutral-500">
                    No document files imported yet. Drag and drop a file above to begin.
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const isReady = file.status === "ready";
                  const isFailed = file.status === "failed";

                  return (
                    <tr key={file.id} className="hover:bg-[#161616]/50 transition-colors">
                      <td className="p-4 font-semibold text-white flex items-center space-x-2">
                        <File className="h-4 w-4 text-[#D4AF37]" />
                        <span className="truncate max-w-xs">{file.filename}</span>
                      </td>
                      <td className="p-4 font-mono text-neutral-400">
                        {(file.file_size_bytes / 1024).toFixed(1)} KB
                      </td>
                      <td className="p-4">
                        {isReady && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] flex items-center space-x-1.5 w-fit">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Ready</span>
                          </span>
                        )}
                        {isFailed && (
                          <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-bold text-[10px] flex items-center space-x-1.5 w-fit" title={file.error_message || ""}>
                            <XCircle className="h-3 w-3" />
                            <span>Failed</span>
                          </span>
                        )}
                        {!isReady && !isFailed && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[10px] flex items-center space-x-1.5 w-fit">
                            <Clock className="h-3 w-3 animate-spin" />
                            <span className="capitalize">{file.status}...</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setDeleteTargetId(file.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                          title="Delete File"
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
      </div>

      {/* Delete Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 max-w-sm w-full space-y-4 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-white">Delete Document Source?</h4>
              <p className="text-xs text-neutral-400">
                This will permanently remove the file source and its knowledge chunks from your agent's memory.
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

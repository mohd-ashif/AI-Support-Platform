"use client";

import React, { useState, useRef } from "react";
import { useKnowledgeBase } from "@/hooks/useKnowledgeBase";
import { useToast } from "@/components/ui/ToastProvider";
import {
  BookOpen,
  FileText,
  Globe,
  HelpCircle,
  Search,
  RefreshCw,
  Trash2,
  Plus,
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Layers,
} from "lucide-react";

export default function KnowledgeBasePage() {
  const toast = useToast();
  const {
    sources,
    isLoading,
    isUploading,
    isCreatingSource,
    isReindexing,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    uploadDocument,
    addUrlSource,
    addFaqSource,
    addArticleSource,
    reindexSource,
    deleteSource,
    refresh,
  } = useKnowledgeBase();

  const [activeTab, setActiveTab] = useState<"documents" | "web" | "faq" | "inspector">("documents");
  const [urlInput, setUrlInput] = useState("");
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleBody, setArticleBody] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      await uploadDocument(files[0]);
      toast.success(`Uploading & indexing ${files[0].name}...`);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err.message || "Failed to upload file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    try {
      await addUrlSource(urlInput.trim());
      setUrlInput("");
      toast.success("Website URL added. Ingestion pipeline started!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err.message || "Failed to add URL.");
    }
  };

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;
    try {
      await addFaqSource(faqQuestion.trim(), faqAnswer.trim());
      setFaqQuestion("");
      setFaqAnswer("");
      toast.success("FAQ created and indexed!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err.message || "Failed to create FAQ.");
    }
  };

  const handleAddArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!articleTitle.trim() || !articleBody.trim()) return;
    try {
      await addArticleSource(articleTitle.trim(), articleBody.trim());
      setArticleTitle("");
      setArticleBody("");
      toast.success("Help Article created and indexed!");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err.message || "Failed to create article.");
    }
  };

  const handleReindex = async (id: string) => {
    try {
      await reindexSource(id);
      toast.success("Re-indexing started for source.");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err.message || "Failed to re-index source.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSource(id);
      toast.success("Knowledge source deleted.");
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err.message || "Failed to delete source.");
    }
  };

  const getStatusBadge = (statusStr: string) => {
    const s = (statusStr || "").toUpperCase();
    if (s === "READY") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded-full">
          <CheckCircle className="h-3 w-3" /> Ready
        </span>
      );
    }
    if (s === "PROCESSING" || s === "INDEXING" || s === "UPLOADING") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded-full">
          <RefreshCw className="h-3 w-3 animate-spin" /> {s}
        </span>
      );
    }
    if (s === "FAILED") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded-full">
          <AlertCircle className="h-3 w-3" /> Failed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-full">
        <Clock className="h-3 w-3" /> {s || "Pending"}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="pb-4 border-b border-[#1F1F1F] flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-[#D4AF37]" />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">AI Knowledge Base & RAG Engine</h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Manage multi-format knowledge (PDF, DOCX, CSV, TXT, MD, Web URLs, FAQs, Articles) with pgvector indexing.
          </p>
        </div>
        <button
          onClick={() => refresh()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] hover:bg-[#1A1A1A] border border-[#262626] rounded-lg text-xs font-medium text-neutral-300 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-[#1F1F1F] pb-2">
        <button
          onClick={() => setActiveTab("documents")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "documents" ? "bg-[#D4AF37] text-black" : "bg-[#141414] text-neutral-400 hover:text-white"
          }`}
        >
          <FileText className="h-4 w-4" /> Documents & Files
        </button>
        <button
          onClick={() => setActiveTab("web")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "web" ? "bg-[#D4AF37] text-black" : "bg-[#141414] text-neutral-400 hover:text-white"
          }`}
        >
          <Globe className="h-4 w-4" /> Web URLs
        </button>
        <button
          onClick={() => setActiveTab("faq")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "faq" ? "bg-[#D4AF37] text-black" : "bg-[#141414] text-neutral-400 hover:text-white"
          }`}
        >
          <HelpCircle className="h-4 w-4" /> FAQs & Articles
        </button>
        <button
          onClick={() => setActiveTab("inspector")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "inspector" ? "bg-[#D4AF37] text-black" : "bg-[#141414] text-neutral-400 hover:text-white"
          }`}
        >
          <Search className="h-4 w-4" /> RAG Inspector (Admin Search)
        </button>
      </div>

      {/* TAB 1: Documents & Files */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="p-6 bg-[#141414] border border-[#262626] rounded-xl text-center space-y-4">
            <div className="inline-flex p-3 bg-neutral-900 border border-neutral-800 rounded-full text-[#D4AF37]">
              <UploadCloud className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Upload Knowledge Documents</h3>
              <p className="text-xs text-neutral-400 mt-1">
                Supports PDF, DOCX, CSV, Markdown (.md), JSON, and Plain Text (.txt) up to 10MB.
              </p>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.docx,.csv,.txt,.json,.md"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-5 py-2 bg-[#D4AF37] hover:bg-[#b8972e] text-black font-bold text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              {isUploading ? "Uploading & Parsing..." : "Select Document File"}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: Web URLs */}
      {activeTab === "web" && (
        <div className="p-6 bg-[#141414] border border-[#262626] rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#D4AF37]" /> Crawl Website Documentation
          </h3>
          <form onSubmit={handleAddUrl} className="flex gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/docs"
              className="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
              required
            />
            <button
              type="submit"
              disabled={isCreatingSource}
              className="px-4 py-2 bg-[#D4AF37] text-black font-bold text-xs rounded-lg hover:bg-[#b8972e] transition-colors disabled:opacity-50"
            >
              {isCreatingSource ? "Submitting..." : "Start Crawling"}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: FAQs & Articles */}
      {activeTab === "faq" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* FAQ Creator */}
          <form onSubmit={handleAddFaq} className="p-6 bg-[#141414] border border-[#262626] rounded-xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-[#D4AF37]" /> Create FAQ Q&A Pair
            </h3>
            <input
              type="text"
              value={faqQuestion}
              onChange={(e) => setFaqQuestion(e.target.value)}
              placeholder="Question (e.g. What is your refund policy?)"
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
              required
            />
            <textarea
              value={faqAnswer}
              onChange={(e) => setFaqAnswer(e.target.value)}
              placeholder="Answer detail..."
              rows={3}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
              required
            />
            <button
              type="submit"
              disabled={isCreatingSource}
              className="w-full py-2 bg-[#D4AF37] text-black font-bold text-xs rounded-lg hover:bg-[#b8972e] transition-colors disabled:opacity-50"
            >
              Add FAQ
            </button>
          </form>

          {/* Help Article Creator */}
          <form onSubmit={handleAddArticle} className="p-6 bg-[#141414] border border-[#262626] rounded-xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#D4AF37]" /> Create Help Article
            </h3>
            <input
              type="text"
              value={articleTitle}
              onChange={(e) => setArticleTitle(e.target.value)}
              placeholder="Article Title (e.g. Account Password Reset Guide)"
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
              required
            />
            <textarea
              value={articleBody}
              onChange={(e) => setArticleBody(e.target.value)}
              placeholder="Article body content..."
              rows={3}
              className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
              required
            />
            <button
              type="submit"
              disabled={isCreatingSource}
              className="w-full py-2 bg-[#D4AF37] text-black font-bold text-xs rounded-lg hover:bg-[#b8972e] transition-colors disabled:opacity-50"
            >
              Add Help Article
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: RAG Inspector (Admin Search) */}
      {activeTab === "inspector" && (
        <div className="p-6 bg-[#141414] border border-[#262626] rounded-xl space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Search className="h-4 w-4 text-[#D4AF37]" /> Test RAG Vector & Hybrid Retrieval
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Type a customer query to inspect top-K retrieved vector chunks, document titles, sections, and similarity scores.
            </p>
          </div>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search e.g. 'refund policy', 'password reset', 'invoice'..."
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
            />
            <Search className="absolute left-3 top-3 h-4 w-4 text-neutral-500" />
          </div>

          {isSearching && (
            <div className="text-xs text-neutral-400 py-4 flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-[#D4AF37]" /> Searching vector index...
            </div>
          )}

          {searchResults && searchResults.results.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs text-neutral-400">
                Top Confidence Score:{" "}
                <span className="text-[#D4AF37] font-bold">{(searchResults.maxConfidence * 100).toFixed(1)}%</span>
              </div>
              {searchResults.results.map((res, i) => (
                <div key={i} className="p-4 bg-neutral-900/60 border border-neutral-800 rounded-lg space-y-1 text-xs">
                  <div className="flex items-center justify-between text-white font-semibold">
                    <span>
                      {res.document_name} {res.page_number && `(Page ${res.page_number})`} {res.section && `• ${res.section}`}
                    </span>
                    <span className="text-emerald-400 text-[11px] font-mono">
                      {(res.similarity_score * 100).toFixed(1)}% similarity
                    </span>
                  </div>
                  <p className="text-neutral-300 font-mono text-[11px] bg-black/40 p-2 rounded border border-neutral-800">
                    {res.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sources List Table */}
      <div className="p-6 bg-[#141414] border border-[#262626] rounded-xl space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="h-4 w-4 text-[#D4AF37]" /> Active Knowledge Sources
        </h3>

        {isLoading ? (
          <div className="space-y-2 py-4">
            <div className="h-10 bg-neutral-900 animate-pulse rounded-lg" />
            <div className="h-10 bg-neutral-900 animate-pulse rounded-lg" />
          </div>
        ) : sources.length === 0 ? (
          <p className="text-xs text-neutral-500 py-6 text-center">No knowledge sources ingested yet.</p>
        ) : (
          <div className="divide-y divide-[#1F1F1F]">
            {sources.map((src) => (
              <div key={src.id} className="py-3 flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-semibold text-white">
                    <span className="text-[10px] font-bold text-[#D4AF37] bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded">
                      {src.type}
                    </span>
                    {src.name}
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    Added {new Date(src.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {getStatusBadge(src.status)}

                  <button
                    onClick={() => handleReindex(src.id)}
                    disabled={isReindexing}
                    title="Re-index document"
                    className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className={`h-4 w-4 ${isReindexing ? "animate-spin" : ""}`} />
                  </button>

                  <button
                    onClick={() => handleDelete(src.id)}
                    title="Delete source"
                    className="p-1.5 text-neutral-400 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

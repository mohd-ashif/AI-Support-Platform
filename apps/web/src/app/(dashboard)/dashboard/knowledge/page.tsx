"use client";

import React, { useState, useRef } from "react";
import { useKnowledgeBase } from "@/hooks/useKnowledgeBase";
import { useToast } from "@/components/ui/ToastProvider";
import { BookOpen } from "lucide-react";
import { WebCrawlerCard } from "@/features/knowledge-base/WebCrawlerCard";
import { FileUploadCard } from "@/features/knowledge-base/FileUploadCard";
import { SourcesListTable } from "@/features/knowledge-base/SourcesListTable";

export default function KnowledgeBasePage() {
  const toast = useToast();
  const {
    allSources,
    isLoading,
    isCrawling,
    isUploading,
    crawlWebsite,
    uploadDocument,
    deleteSource,
    refresh,
  } = useKnowledgeBase();

  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || isCrawling) return;

    try {
      await crawlWebsite(urlInput.trim());
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
      await uploadDocument(files[0]);
      toast.success(`Successfully uploaded and indexed ${files[0].name}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to upload file document.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteSource = async (id: string, type: "web" | "file") => {
    try {
      await deleteSource(id, type);
      toast.success("Knowledge source deleted successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete source.");
    }
  };

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
        <WebCrawlerCard
          urlInput={urlInput}
          setUrlInput={setUrlInput}
          isCrawling={isCrawling}
          onStartCrawl={handleStartCrawl}
        />
        <FileUploadCard
          fileInputRef={fileInputRef}
          isUploading={isUploading}
          onFileUpload={handleFileUpload}
        />
      </div>

      <SourcesListTable
        sources={allSources}
        isLoading={isLoading}
        onDeleteSource={handleDeleteSource}
        onRefresh={refresh}
      />
    </div>
  );
}

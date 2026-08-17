"use client";

import React, { useState } from "react";
import {
  GitBranch,
  FolderGit2,
  Search,
  Lock,
  Globe,
  Loader2,
  Check,
  X,
  FileText,
  BookOpen,
  HelpCircle,
  Code2,
  ShieldAlert,
  ArrowRight,
  ChevronLeft,
} from "lucide-react";
import { useGitHubIntegration } from "@/hooks/useGitHubIntegration";
import { GitHubRepositoryItem, ConnectRepoPayload } from "@/services/githubService";
import { useToast } from "@/components/ui/ToastProvider";

interface GitHubRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GitHubRepoModal({ isOpen, onClose }: GitHubRepoModalProps) {
  const toast = useToast();
  const {
    repositories,
    isLoadingRepositories,
    repoSearch,
    setRepoSearch,
    repoPage,
    setRepoPage,
    branches,
    isLoadingBranches,
    setSelectedRepoForBranch,
    connectRepo,
    isConnectingRepo,
  } = useGitHubIntegration();

  // Wizard Steps: 1 = Repo List, 2 = Branch Select, 3 = Config Studio
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepositoryItem | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("main");

  // Configuration options
  const [syncReadme, setSyncReadme] = useState(true);
  const [syncMarkdown, setSyncMarkdown] = useState(true);
  const [syncDocs, setSyncDocs] = useState(true);
  const [syncIssues, setSyncIssues] = useState(false);
  const [syncPullRequests, setSyncPullRequests] = useState(false);
  const [extensions, setExtensions] = useState<string>(".md, .mdx, .txt, .json, .yaml, .ts, .py");
  const [ignorePatterns, setIgnorePatterns] = useState<string>("node_modules/, dist/, build/, .git/, coverage/");

  if (!isOpen) return null;

  const handleSelectRepo = (repo: GitHubRepositoryItem) => {
    setSelectedRepo(repo);
    setSelectedBranch(repo.default_branch || "main");
    setSelectedRepoForBranch({ owner: repo.owner, name: repo.name });
    setStep(2);
  };

  const handleConfirmBranch = () => {
    if (!selectedBranch) return;
    setStep(3);
  };

  const handleSubmitConnect = async () => {
    if (!selectedRepo) return;

    const parsedExts = extensions.split(",").map((e) => e.trim()).filter(Boolean);
    const parsedIgnores = ignorePatterns.split(",").map((i) => i.trim()).filter(Boolean);

    const payload: ConnectRepoPayload = {
      repository_id: selectedRepo.id,
      repository_name: selectedRepo.name,
      owner: selectedRepo.owner,
      branch: selectedBranch,
      default_branch: selectedRepo.default_branch || "main",
      is_private: selectedRepo.is_private,
      sync_config: {
        sync_readme: syncReadme,
        sync_markdown: syncMarkdown,
        sync_docs: syncDocs,
        sync_issues: syncIssues,
        sync_pull_requests: syncPullRequests,
        include_extensions: parsedExts,
        ignore_patterns: parsedIgnores,
      },
    };

    try {
      await connectRepo(payload);
      toast.success(`Repository ${selectedRepo.owner}/${selectedRepo.name} connected successfully!`);
      onClose();
      setStep(1);
      setSelectedRepo(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to connect repository.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0D0D0D] border border-[#222222] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 border-b border-[#1A1A1A] flex items-center justify-between bg-[#111111]">
          <div className="flex items-center space-x-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2)}
                className="p-1.5 rounded-lg bg-[#1F1F1F] text-neutral-300 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="p-2 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
              <FolderGit2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">
                {step === 1 && "Select GitHub Repository"}
                {step === 2 && `Select Branch (${selectedRepo?.full_name})`}
                {step === 3 && `Configure Repository Sync`}
              </h2>
              <p className="text-xs text-neutral-400">
                {step === 1 && "Choose a repository to use as a developer knowledge source."}
                {step === 2 && "Choose the target branch for indexing code & docs."}
                {step === 3 && "Configure documentation parsing & ignore rules."}
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: Repository List */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Search repository by name or owner..."
                  value={repoSearch}
                  onChange={(e) => {
                    setRepoSearch(e.target.value);
                    setRepoPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {isLoadingRepositories ? (
                <div className="py-12 flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="h-6 w-6 text-[#D4AF37] animate-spin" />
                  <span className="text-xs text-neutral-400">Loading GitHub repositories...</span>
                </div>
              ) : repositories.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 text-xs bg-[#050505] rounded-2xl border border-[#1A1A1A] p-6">
                  No repositories found matching your query.
                </div>
              ) : (
                <div className="space-y-2">
                  {repositories.map((repo) => (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => handleSelectRepo(repo)}
                      className="w-full p-4 rounded-2xl bg-[#050505] border border-[#1F1F1F] hover:border-[#D4AF37]/50 hover:bg-[#111111] transition-all text-left group flex items-center justify-between"
                    >
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-sm text-white group-hover:text-[#D4AF37]">
                            {repo.full_name}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1C1C1C] text-neutral-400 border border-[#2B2B2B] flex items-center space-x-1">
                            {repo.is_private ? <Lock className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                            <span>{repo.is_private ? "Private" : "Public"}</span>
                          </span>
                        </div>
                        {repo.description && (
                          <p className="text-xs text-neutral-400 line-clamp-1">{repo.description}</p>
                        )}
                        <div className="flex items-center space-x-3 text-[10px] text-neutral-500 pt-1">
                          <span className="flex items-center space-x-1">
                            <GitBranch className="h-3 w-3" />
                            <span>{repo.default_branch}</span>
                          </span>
                        </div>
                      </div>

                      <ArrowRight className="h-4 w-4 text-neutral-600 group-hover:text-[#D4AF37] group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Branch Selection */}
          {step === 2 && selectedRepo && (
            <div className="space-y-6">
              <div className="bg-[#050505] p-4 rounded-2xl border border-[#1A1A1A] space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-500">Target Repository</span>
                <p className="text-sm font-extrabold text-white">{selectedRepo.full_name}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300">Select Branch to Synchronize</label>
                {isLoadingBranches ? (
                  <div className="py-8 flex items-center justify-center space-x-2 text-xs text-neutral-400">
                    <Loader2 className="h-4 w-4 text-[#D4AF37] animate-spin" />
                    <span>Fetching repository branches...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                    {branches.map((b) => (
                      <button
                        key={b.name}
                        type="button"
                        onClick={() => setSelectedBranch(b.name)}
                        className={`p-3 rounded-xl border text-xs text-left flex items-center justify-between transition-all ${
                          selectedBranch === b.name
                            ? "bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37] font-bold"
                            : "bg-[#050505] border border-[#1F1F1F] text-neutral-300 hover:border-neutral-700"
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <GitBranch className="h-3.5 w-3.5" />
                          <span>{b.name}</span>
                        </div>
                        {selectedBranch === b.name && <Check className="h-4 w-4 text-[#D4AF37]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleConfirmBranch}
                className="w-full py-3 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs hover:brightness-110 flex items-center justify-center space-x-2"
              >
                <span>Continue to Configuration</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* STEP 3: Sync Configuration Studio */}
          {step === 3 && selectedRepo && (
            <div className="space-y-6">
              <div className="bg-[#050505] p-4 rounded-2xl border border-[#1A1A1A] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-500">Repository & Branch</span>
                  <p className="text-xs font-extrabold text-white">
                    {selectedRepo.full_name} <span className="text-[#D4AF37]">({selectedBranch})</span>
                  </p>
                </div>
              </div>

              {/* Toggles for Knowledge Types */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-neutral-300">Default Knowledge Ingestion</label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="p-3.5 rounded-xl bg-[#050505] border border-[#1F1F1F] flex items-center justify-between cursor-pointer hover:border-neutral-700">
                    <div className="flex items-center space-x-2.5">
                      <FileText className="h-4 w-4 text-[#D4AF37]" />
                      <span className="text-xs font-semibold text-white">README.md</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={syncReadme}
                      onChange={(e) => setSyncReadme(e.target.checked)}
                      className="accent-[#D4AF37]"
                    />
                  </label>

                  <label className="p-3.5 rounded-xl bg-[#050505] border border-[#1F1F1F] flex items-center justify-between cursor-pointer hover:border-neutral-700">
                    <div className="flex items-center space-x-2.5">
                      <BookOpen className="h-4 w-4 text-[#D4AF37]" />
                      <span className="text-xs font-semibold text-white">docs/ Folder</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={syncDocs}
                      onChange={(e) => setSyncDocs(e.target.checked)}
                      className="accent-[#D4AF37]"
                    />
                  </label>

                  <label className="p-3.5 rounded-xl bg-[#050505] border border-[#1F1F1F] flex items-center justify-between cursor-pointer hover:border-neutral-700">
                    <div className="flex items-center space-x-2.5">
                      <Code2 className="h-4 w-4 text-[#D4AF37]" />
                      <span className="text-xs font-semibold text-white">Markdown Files (*.md)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={syncMarkdown}
                      onChange={(e) => setSyncMarkdown(e.target.checked)}
                      className="accent-[#D4AF37]"
                    />
                  </label>

                  <label className="p-3.5 rounded-xl bg-[#050505] border border-[#1F1F1F] flex items-center justify-between cursor-pointer hover:border-neutral-700">
                    <div className="flex items-center space-x-2.5">
                      <HelpCircle className="h-4 w-4 text-neutral-400" />
                      <span className="text-xs font-semibold text-white">GitHub Issues</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={syncIssues}
                      onChange={(e) => setSyncIssues(e.target.checked)}
                      className="accent-[#D4AF37]"
                    />
                  </label>
                </div>
              </div>

              {/* Include Extensions & Ignore Rules */}
              <div className="space-y-4 pt-2 border-t border-[#1A1A1A]">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">File Extensions to Index</label>
                  <input
                    type="text"
                    value={extensions}
                    onChange={(e) => setExtensions(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37]"
                    placeholder=".md, .mdx, .txt, .json, .ts, .py"
                  />
                  <p className="text-[10px] text-neutral-500">Comma-separated list of allowed file extensions.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">Ignore Patterns</label>
                  <input
                    type="text"
                    value={ignorePatterns}
                    onChange={(e) => setIgnorePatterns(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs font-mono text-white focus:outline-none focus:border-[#D4AF37]"
                    placeholder="node_modules/, dist/, build/, .git/, coverage/"
                  />
                  <p className="text-[10px] text-neutral-500">Comma-separated directory and secret ignore patterns.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmitConnect}
                disabled={isConnectingRepo}
                className="w-full py-3.5 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs hover:brightness-110 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {isConnectingRepo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                    <span>Connecting Repository...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Connect & Start Sync</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

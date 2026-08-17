"use client";

import React, { useState } from "react";
import {
  Github,
  GitBranch,
  FolderGit2,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useGitHubIntegration } from "@/hooks/useGitHubIntegration";
import { GitHubRepoModal } from "./GitHubRepoModal";
import { CodeExplainerModal } from "./CodeExplainerModal";
import { useToast } from "@/components/ui/ToastProvider";

export function GitHubConnectionCard() {
  const toast = useToast();
  const {
    connection,
    isConnected,
    isLoadingConnection,
    connectedRepos,
    isLoadingConnectedRepos,
    connectGitHub,
    isConnectingGitHub,
    disconnectGitHub,
    isDisconnectingGitHub,
    disconnectRepo,
    triggerSync,
    refetchConnection,
  } = useGitHubIntegration();

  const [isRepoModalOpen, setIsRepoModalOpen] = useState(false);
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const [explainerRepoId, setExplainerRepoId] = useState<string | undefined>(undefined);

  // Auto-detect OAuth return status from URL query parameters
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const statusParam = params.get("status");
      const userParam = params.get("user");
      const errorParam = params.get("error");

      if (statusParam === "github_success") {
        toast.success(`GitHub account @${userParam || ""} connected successfully!`);
        refetchConnection();
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (statusParam === "github_error") {
        toast.error(errorParam || "Failed to complete GitHub authentication.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleConnect = async () => {
    try {
      await connectGitHub();
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate GitHub authentication.");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGitHub();
      toast.success("GitHub account disconnected successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect GitHub account.");
    }
  };

  const handleDisconnectRepo = async (repoId: string, repoName: string) => {
    try {
      await disconnectRepo(repoId);
      toast.success(`Repository ${repoName} disconnected.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to disconnect repository.");
    }
  };

  const handleTriggerSync = async (repoId: string, repoName: string) => {
    try {
      await triggerSync(repoId);
      toast.success(`Background sync triggered for ${repoName}.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger background sync.");
    }
  };

  if (isLoadingConnection) {
    return (
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 flex items-center justify-center space-x-3 text-xs text-neutral-400">
        <Loader2 className="h-5 w-5 text-[#D4AF37] animate-spin" />
        <span>Checking GitHub integration status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* GitHub Integration Main Card */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222222]">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-[#1C1C1C] border border-[#2B2B2B] text-white">
              <Github className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-white">GitHub Developer Connector</h3>
                {isConnected && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider flex items-center space-x-1">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Connected</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Connect GitHub repositories as developer knowledge sources for your AI support agent.
              </p>
            </div>
          </div>

          {!isConnected ? (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnectingGitHub}
              className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs hover:brightness-110 disabled:opacity-50 flex items-center space-x-2 shrink-0 shadow-lg shadow-[#D4AF37]/10"
            >
              {isConnectingGitHub ? (
                <Loader2 className="h-4 w-4 animate-spin text-black" />
              ) : (
                <Github className="h-4 w-4 text-black" />
              )}
              <span>Connect GitHub</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsRepoModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs hover:brightness-110 flex items-center space-x-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Select Repository</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnectingGitHub}
                className="px-3.5 py-2 rounded-xl bg-[#1A1A1A] border border-[#2B2B2B] text-neutral-400 hover:text-red-400 hover:border-red-500/30 transition-colors text-xs font-bold"
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* Account Metadata when Connected */}
        {isConnected && connection && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
            <div className="bg-[#050505] border border-[#1F1F1F] p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">GitHub Username</span>
              <p className="text-sm font-extrabold text-white flex items-center space-x-2">
                {connection.github_avatar_url && (
                  <img
                    src={connection.github_avatar_url}
                    alt={connection.github_username}
                    className="h-4 w-4 rounded-full"
                  />
                )}
                <span>@{connection.github_username}</span>
              </p>
            </div>

            <div className="bg-[#050505] border border-[#1F1F1F] p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Status</span>
              <p className="text-xs font-mono font-bold text-emerald-400 uppercase">
                {connection.status}
              </p>
            </div>

            <div className="bg-[#050505] border border-[#1F1F1F] p-4 rounded-xl space-y-1">
              <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Security</span>
              <p className="text-xs font-bold text-neutral-300 flex items-center space-x-1 text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Encrypted AES-GCM</span>
              </p>
            </div>
          </div>
        )}

        {/* Connected Repositories Section */}
        {isConnected && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-neutral-400">
                Connected Repositories ({connectedRepos.length})
              </h4>
            </div>

            {isLoadingConnectedRepos ? (
              <div className="py-6 text-center text-xs text-neutral-500 flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 text-[#D4AF37] animate-spin" />
                <span>Loading repositories...</span>
              </div>
            ) : connectedRepos.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#050505] border border-[#1F1F1F] text-center space-y-3">
                <FolderGit2 className="h-8 w-8 text-neutral-600 mx-auto" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white">No GitHub Repositories Connected</p>
                  <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                    Click "Select Repository" above to select a repository and branch to index code and docs into SupportAI.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRepoModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs hover:brightness-110 inline-flex items-center space-x-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Select Repository</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {connectedRepos.map((repo) => (
                  <div
                    key={repo.id}
                    className="p-4 rounded-2xl bg-[#050505] border border-[#1F1F1F] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <FolderGit2 className="h-4 w-4 text-[#D4AF37]" />
                        <span className="text-sm font-extrabold text-white">
                          {repo.owner}/{repo.repository_name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#1A1A1A] text-neutral-300 border border-[#2B2B2B] flex items-center space-x-1">
                          <GitBranch className="h-3 w-3 text-[#D4AF37]" />
                          <span>{repo.branch}</span>
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 text-[11px] text-neutral-500 pt-0.5">
                        <span>
                          Last sync: {repo.last_synced_at ? new Date(repo.last_synced_at).toLocaleTimeString() : "Never"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center space-x-1 ${
                          repo.sync_status === "ready"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : repo.sync_status === "syncing"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                            : repo.sync_status === "failed"
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-neutral-500/10 text-neutral-400 border border-neutral-500/20"
                        }`}
                      >
                        {repo.sync_status === "ready" && <CheckCircle2 className="h-3 w-3" />}
                        {repo.sync_status === "syncing" && <RefreshCw className="h-3 w-3 animate-spin" />}
                        {repo.sync_status === "failed" && <AlertTriangle className="h-3 w-3" />}
                        <span>{repo.sync_status}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setExplainerRepoId(repo.id);
                          setIsExplainerOpen(true);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-[#1A1A1A] border border-[#2B2B2B] text-neutral-300 hover:text-white hover:border-[#D4AF37] transition-colors text-[11px] font-bold flex items-center space-x-1"
                        title="Explain Code with AI"
                      >
                        <Sparkles className="h-3 w-3 text-[#D4AF37]" />
                        <span>Explain Code</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleTriggerSync(repo.id, `${repo.owner}/${repo.repository_name}`)}
                        className="p-2 rounded-xl bg-[#1A1A1A] border border-[#2B2B2B] text-neutral-300 hover:text-white hover:border-[#D4AF37] transition-colors"
                        title="Sync Now"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDisconnectRepo(repo.id, `${repo.owner}/${repo.repository_name}`)}
                        className="p-2 rounded-xl bg-[#1A1A1A] border border-[#2B2B2B] text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Disconnect Repository"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* GitHub Repository Selection Modal */}
      <GitHubRepoModal isOpen={isRepoModalOpen} onClose={() => setIsRepoModalOpen(false)} />

      {/* AI Code Explainer Modal */}
      <CodeExplainerModal
        isOpen={isExplainerOpen}
        onClose={() => setIsExplainerOpen(false)}
        repoId={explainerRepoId}
      />
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  Github,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  FolderGit2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useGitHubIntegration } from "@/hooks/useGitHubIntegration";
import { useToast } from "@/components/ui/ToastProvider";

interface GitHubIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  workspaceId?: string;
}

export function GitHubIssueModal({
  isOpen,
  onClose,
  conversationId,
  workspaceId,
}: GitHubIssueModalProps) {
  const toast = useToast();
  const { connectedRepos } = useGitHubIntegration(workspaceId);

  const [selectedRepoId, setSelectedRepoId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<any>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [customerContext, setCustomerContext] = useState("");

  useEffect(() => {
    if (connectedRepos.length > 0 && !selectedRepoId) {
      setSelectedRepoId(connectedRepos[0].id);
    }
  }, [connectedRepos, selectedRepoId]);

  // Auto-generate AI preview on open
  useEffect(() => {
    if (isOpen && conversationId) {
      handleGeneratePreview();
    }
  }, [isOpen, conversationId]);

  if (!isOpen) return null;

  async function handleGeneratePreview() {
    setIsGenerating(true);
    setCreatedResult(null);

    try {
      const headers: Record<string, string> = {};
      if (workspaceId) headers["X-Workspace-Id"] = workspaceId;

      const preview = await apiFetch<any>(
        `/integrations/github/conversations/${conversationId}/generate-issue-preview`,
        { method: "POST", headers }
      );

      setTitle(preview.title || "");
      setDescription(preview.description || "");
      setStepsToReproduce(preview.steps_to_reproduce || "");
      setExpectedBehavior(preview.expected_behavior || "");
      setActualBehavior(preview.actual_behavior || "");
      setPriority(preview.priority || "medium");
      setCustomerContext(preview.customer_context || "");
      toast.success("AI issue draft generated from conversation transcript!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate issue preview.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRepoId) {
      toast.error("Please select a target GitHub repository.");
      return;
    }
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = {};
      if (workspaceId) headers["X-Workspace-Id"] = workspaceId;

      const res = await apiFetch<any>(
        `/integrations/github/repositories/${selectedRepoId}/issues`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            steps_to_reproduce: stepsToReproduce.trim(),
            expected_behavior: expectedBehavior.trim(),
            actual_behavior: actualBehavior.trim(),
            priority,
            customer_context: customerContext,
          }),
        }
      );

      setCreatedResult(res);
      toast.success(`GitHub Issue #${res.issue_number} created successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create issue on GitHub.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0D0D0D] border border-[#222222] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-[#1A1A1A] flex items-center justify-between bg-[#111111]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
              <Github className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Create GitHub Issue</h2>
              <p className="text-xs text-neutral-400">
                AI summarizes support conversation into a structured GitHub bug report for agent review.
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

        {/* Form Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {createdResult ? (
            <div className="p-6 rounded-2xl bg-[#050505] border border-emerald-500/30 text-center space-y-4 animate-in zoom-in-95">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full w-fit mx-auto border border-emerald-500/20">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-white">
                  GitHub Issue #{createdResult.issue_number} Created!
                </h3>
                <p className="text-xs text-neutral-400 font-mono">{createdResult.title}</p>
              </div>

              <div className="pt-2 flex items-center justify-center space-x-3">
                {createdResult.html_url && (
                  <a
                    href={createdResult.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs hover:brightness-110 flex items-center space-x-1.5"
                  >
                    <span>View Issue on GitHub</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#1C1C1C] border border-[#2B2B2B] text-neutral-300 text-xs font-bold hover:text-white"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitCreate} className="space-y-4">
              {/* Target Repository Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 flex items-center space-x-1.5">
                  <FolderGit2 className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>Target GitHub Repository</span>
                </label>
                <select
                  value={selectedRepoId}
                  onChange={(e) => setSelectedRepoId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                >
                  {connectedRepos.length === 0 ? (
                    <option value="">No connected repositories found</option>
                  ) : (
                    connectedRepos.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.owner}/{r.repository_name} ({r.branch})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-300">Issue Title</label>
                  {isGenerating && (
                    <span className="text-[10px] text-[#D4AF37] flex items-center space-x-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>AI Draft Generating...</span>
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs font-bold text-white focus:outline-none focus:border-[#D4AF37]"
                  placeholder="e.g. Bug: 401 Unauthorized error during JWT refresh flow"
                />
              </div>

              {/* Priority & Context */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">Priority Level</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                    <option value="critical">Critical Priority</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-300">Customer Context</label>
                  <input
                    type="text"
                    value={customerContext}
                    onChange={(e) => setCustomerContext(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white focus:outline-none focus:border-[#D4AF37] leading-relaxed"
                />
              </div>

              {/* Steps to Reproduce */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300">Steps to Reproduce</label>
                <textarea
                  rows={2}
                  value={stepsToReproduce}
                  onChange={(e) => setStepsToReproduce(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#050505] border border-[#222222] text-xs font-mono text-neutral-200 focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-[#1C1C1C] border border-[#2B2B2B] text-neutral-400 font-bold text-xs hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !title.trim() || !selectedRepoId}
                  className="px-5 py-2.5 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs hover:brightness-110 disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-[#D4AF37]/10"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 text-black" />
                  )}
                  <span>Approve & Create GitHub Issue</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

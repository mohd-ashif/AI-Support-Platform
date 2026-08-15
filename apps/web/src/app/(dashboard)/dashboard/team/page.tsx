"use client";

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  useTeamMembers,
  useInviteMemberMutation,
  useUpdateTeamRoleMutation,
} from "@/hooks/queries/useTeamQueries";
import { useToast } from "@/components/ui/ToastProvider";
import { TeamTable } from "./components/TeamTable";
import { InviteMemberModal } from "./components/InviteMemberModal";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  UserCheck,
  Check,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
  Copy,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface DemoAccount {
  email: string;
  password: string;
  role: string;
  name: string;
}

export default function TeamManagementPage() {
  const toast = useToast();
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const workspaces = useSelector((state: RootState) => state.auth.workspaces || []);
  const activeWs = selectedWorkspace || (workspaces.length > 0 ? workspaces[0] : null);

  const { data: members = [], isLoading, isError, refetch } = useTeamMembers(activeWs?.id);
  const inviteMemberMutation = useInviteMemberMutation(activeWs?.id);
  const updateRoleMutation = useUpdateTeamRoleMutation(activeWs?.id);

  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [createdInvite, setCreatedInvite] = useState<{ email: string; role: string; link: string } | null>(null);
  const [seedingLoading, setSeedingLoading] = useState(false);

  const handleInviteSubmit = async (email: string, role: "admin" | "agent") => {
    if (!activeWs?.id) return;
    setError(null);
    try {
      const res = await inviteMemberMutation.mutateAsync({ email, role });
      setCreatedInvite({
        email,
        role,
        link: res.invite_link || "",
      });
      setInviteModalOpen(false);
      toast.success(`Invitation sent to ${email}`);
    } catch (err: any) {
      const msg = err.message || "Failed to invite team member";
      setError(msg);
      toast.error(msg);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!activeWs?.id) return;
    try {
      await updateRoleMutation.mutateAsync({ memberId, role: newRole });
      toast.success("Team member role updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update member role");
    }
  };

  const handleSeedDemoAccounts = async () => {
    if (!activeWs?.id) return;
    setSeedingLoading(true);
    setError(null);
    try {
      const demoEmail = `demo_agent_${Date.now()}@example.com`;
      const res = await inviteMemberMutation.mutateAsync({ email: demoEmail, role: "agent" });
      setCreatedInvite({ email: demoEmail, role: "agent", link: res.invite_link || "" });
      toast.success("Generated demo role account invitation link!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate demo accounts");
    } finally {
      setSeedingLoading(false);
    }
  };

  const copyCreds = (email: string) => {
    navigator.clipboard.writeText(`Email: ${email} | Password: Password123!`);
    setCopiedEmail(email);
    toast.info("Credentials copied to clipboard!");
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const permissionsMatrix = [
    { feature: "Manage Organization & Workspace Settings", owner: true, admin: false, agent: false },
    { feature: "Manage Subscription Plan & Billing", owner: true, admin: false, agent: false },
    { feature: "Manage API Keys & Outbound Webhooks", owner: true, admin: false, agent: false },
    { feature: "Invite Team Members & Modify Roles", owner: true, admin: true, agent: false },
    { feature: "Train AI Knowledge Base (Crawl & Files)", owner: true, admin: true, agent: false },
    { feature: "Customize AI Chat Widget & Branding", owner: true, admin: true, agent: false },
    { feature: "View Analytics & Resolution Reports", owner: true, admin: true, agent: true },
    { feature: "Live Inbox: Operator Human Takeover", owner: true, admin: true, agent: true },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1F1F1F]">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="h-6 w-6 text-[#D4AF37]" />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Team Members & Role-Based Access Control (RBAC)
            </h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Manage workspace permissions, invite team operators, and switch role-based test accounts.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleSeedDemoAccounts}
            disabled={seedingLoading}
            className="px-4 py-2.5 rounded-xl bg-[#141414] border border-[#222222] hover:border-[#D4AF37]/50 text-xs font-bold text-neutral-200 hover:text-white transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {seedingLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
            ) : (
              <Sparkles className="h-4 w-4 text-[#D4AF37]" />
            )}
            <span>Generate Role Test Accounts</span>
          </button>

          <button
            type="button"
            onClick={() => setInviteModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] text-xs font-extrabold hover:brightness-110 transition-all shadow-md flex items-center space-x-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>Invite Member</span>
          </button>
        </div>
      </div>

      {/* Generated Team Invitation Details Box */}
      {createdInvite && (
        <div className="bg-[#111111] border border-[#D4AF37] rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-[#222222] pb-3">
            <div className="flex items-center space-x-2 text-[#D4AF37]">
              <Sparkles className="h-5 w-5" />
              <h3 className="text-sm font-extrabold">Team Invitation Created Successfully</h3>
            </div>
            <button
              type="button"
              onClick={() => setCreatedInvite(null)}
              className="text-neutral-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-xs text-neutral-300">
            Invitation token created for <strong className="text-white">{createdInvite.email}</strong> as an{" "}
            <span className="text-emerald-400 font-extrabold uppercase">{createdInvite.role}</span>. An email notification has been dispatched to their inbox!
          </p>

          <div className="bg-[#050505] border border-[#222222] rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <input
              type="text"
              readOnly
              value={createdInvite.link}
              className="w-full sm:flex-1 bg-transparent text-xs font-mono text-[#D4AF37] focus:outline-none truncate"
            />
            <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(createdInvite.link);
                  toast.success("Invitation link copied to clipboard!");
                }}
                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black font-bold text-xs hover:brightness-110 flex items-center justify-center space-x-1"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Link</span>
              </button>
              <a
                href={createdInvite.link}
                target="_blank"
                rel="noreferrer"
                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 font-bold text-xs text-center"
              >
                Open Page ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Role-Based Permissions Matrix */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="pb-3 border-b border-[#222222]">
          <h3 className="text-sm font-bold text-white">Role-Based Permission Matrix</h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Enterprise RBAC rules enforced server-side across router dependencies.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-neutral-400 border-b border-[#1F1F1F]">
                <th className="pb-3 font-bold">Platform Capability / Action</th>
                <th className="pb-3 font-bold text-center w-28">
                  <div className="inline-flex items-center space-x-1 text-[#D4AF37]">
                    <Shield className="h-3.5 w-3.5" />
                    <span>Owner</span>
                  </div>
                </th>
                <th className="pb-3 font-bold text-center w-28">
                  <div className="inline-flex items-center space-x-1 text-indigo-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Admin</span>
                  </div>
                </th>
                <th className="pb-3 font-bold text-center w-28">
                  <div className="inline-flex items-center space-x-1 text-emerald-400">
                    <UserCheck className="h-3.5 w-3.5" />
                    <span>Agent</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {permissionsMatrix.map((p) => (
                <tr key={p.feature} className="hover:bg-[#141414] transition-colors">
                  <td className="py-3 font-semibold text-neutral-200">{p.feature}</td>
                  <td className="py-3 text-center">
                    {p.owner ? (
                      <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-neutral-600 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {p.admin ? (
                      <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-neutral-600 mx-auto" />
                    )}
                  </td>
                  <td className="py-3 text-center">
                    {p.agent ? (
                      <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                    ) : (
                      <X className="h-4 w-4 text-neutral-600 mx-auto" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Team Directory Component */}
      {isLoading ? (
        <table className="w-full text-left text-xs">
          <TableSkeleton rows={4} columns={4} />
        </table>
      ) : isError ? (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center space-y-3">
          <AlertCircle className="h-6 w-6 text-red-400 mx-auto" />
          <p className="text-xs text-red-300 font-semibold">Unable to load team members for this workspace.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-200 text-xs font-bold transition-all inline-flex items-center space-x-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry Loading</span>
          </button>
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          title="No Team Members Found"
          description="Invite your support agents and administrators to collaborate on live customer inquiries."
          action={
            <button
              type="button"
              onClick={() => setInviteModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-[#D4AF37] text-black font-bold text-xs"
            >
              Invite First Member
            </button>
          }
        />
      ) : (
        <TeamTable
          members={members}
          loading={false}
          onRoleChange={handleRoleChange}
          workspaceId={activeWs?.id}
        />
      )}

      {/* Invite Member Dialog Modal Component */}
      <InviteMemberModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onSubmit={handleInviteSubmit}
        loading={inviteMemberMutation.isPending}
        error={error}
      />
    </div>
  );
}

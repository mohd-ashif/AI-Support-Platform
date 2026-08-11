"use client";

import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { apiFetch } from "@/lib/api";
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
  Lock,
} from "lucide-react";

interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "agent";
  avatar_url?: string | null;
  joined_at: string;
}

interface DemoAccount {
  email: string;
  password: string;
  role: string;
  name: string;
}

export default function TeamManagementPage() {
  const { selectedWorkspace, workspaces } = useSelector((state: RootState) => state.auth);
  const activeWs = selectedWorkspace || (workspaces.length > 0 ? workspaces[0] : null);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent">("agent");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);
  const [seedingLoading, setSeedingLoading] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!activeWs?.id) return;
    fetchMembers();
  }, [activeWs?.id]);

  const fetchMembers = async () => {
    if (!activeWs?.id) return;
    setLoading(true);
    try {
      const data = await apiFetch("/settings/team", {
        headers: { "X-Workspace-Id": activeWs.id },
      });
      setMembers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const [createdInvite, setCreatedInvite] = useState<{ email: string; role: string; link: string } | null>(null);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeWs?.id) return;

    setInviteLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/settings/team/invite", {
        method: "POST",
        headers: { "X-Workspace-Id": activeWs.id },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setCreatedInvite({
        email: inviteEmail,
        role: inviteRole,
        link: res.invite_link || "",
      });
      setInviteEmail("");
      setInviteModalOpen(false);
      fetchMembers();
    } catch (err: any) {
      setError(err.message || "Failed to invite team member");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!activeWs?.id) return;
    try {
      await apiFetch(`/settings/team/${memberId}/role`, {
        method: "PATCH",
        headers: { "X-Workspace-Id": activeWs.id },
        body: JSON.stringify({ role: newRole }),
      });
      fetchMembers();
    } catch (err: any) {
      setError(err.message || "Failed to update member role");
    }
  };

  const handleSeedDemoAccounts = async () => {
    if (!activeWs?.id) return;
    setSeedingLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/settings/team/invite", {
        method: "POST",
        headers: { "X-Workspace-Id": activeWs.id },
        body: JSON.stringify({ email: `demo_agent_${Date.now()}@example.com`, role: "agent" }),
      });
      setSuccessMessage(`Generated demo invitation link: ${res.invite_link}`);
      fetchMembers();
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      setError(err.message || "Failed to generate demo accounts");
    } finally {
      setSeedingLoading(false);
    }
  };


  const copyCreds = (email: string) => {
    navigator.clipboard.writeText(`Email: ${email} | Password: Password123!`);
    setCopiedEmail(email);
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

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center space-x-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

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
            Invitation token created for <strong className="text-white">{createdInvite.email}</strong> as an <span className="text-emerald-400 font-extrabold uppercase">{createdInvite.role}</span>. An email notification has been dispatched to their inbox!
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
                  alert("Invitation link copied to clipboard!");
                }}
                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-[#D4AF37] text-black font-bold text-xs hover:brightness-110 flex items-center justify-center space-x-1"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Link</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const subject = encodeURIComponent("You're invited to join SupportAI Workspace");
                  const body = encodeURIComponent(`Hi!\n\nYou have been invited to join SupportAI Workspace as ${createdInvite.role}.\n\nClick here to accept: ${createdInvite.link}`);
                  window.open(`mailto:${createdInvite.email}?subject=${subject}&body=${body}`, "_blank");
                }}
                className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-[#1F1F1F] border border-[#333333] text-neutral-200 hover:text-white font-bold text-xs"
              >
                Send Email App
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

      {/* Generated Demo Accounts Box */}
      {demoAccounts.length > 0 && (
        <div className="bg-[#111111] border border-[#D4AF37]/40 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-5 w-5 text-[#D4AF37]" />
            <h3 className="text-sm font-bold text-white">Pre-Configured Role Test Credentials</h3>
          </div>
          <p className="text-xs text-neutral-400">
            Use these created accounts to log in and test role-based permission boundaries:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {demoAccounts.map((acc) => (
              <div
                key={acc.email}
                className="bg-[#050505] border border-[#222222] rounded-xl p-4 space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase text-[#D4AF37]">{acc.role}</span>
                    <span className="text-[10px] text-neutral-500">Default Pass: Password123!</span>
                  </div>
                  <p className="text-xs font-bold text-white mt-1">{acc.name}</p>
                  <p className="text-xs font-mono text-neutral-400 truncate">{acc.email}</p>
                </div>

                <button
                  type="button"
                  onClick={() => copyCreds(acc.email)}
                  className="w-full flex items-center justify-center space-x-1.5 py-1.5 rounded-lg bg-[#141414] hover:bg-[#1F1F1F] text-xs font-semibold text-neutral-300 transition-colors border border-[#262626]"
                >
                  {copiedEmail === acc.email ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400 text-[11px]">Copied Credentials!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5 text-neutral-400" />
                      <span className="text-[11px]">Copy Login Credentials</span>
                    </>
                  )}
                </button>
              </div>
            ))}
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

      {/* Active Team Directory */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
          <h3 className="text-sm font-bold text-white">Active Workspace Members ({members.length})</h3>
          <span className="text-xs text-neutral-500 font-mono">Workspace ID: {activeWs?.id || "N/A"}</span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-neutral-500 flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
            <span className="text-xs">Loading team members...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-neutral-400 border-b border-[#1F1F1F]">
                  <th className="pb-3 font-bold">User</th>
                  <th className="pb-3 font-bold">Role</th>
                  <th className="pb-3 font-bold">Joined Date</th>
                  <th className="pb-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1A1A]">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-[#141414] transition-colors">
                    <td className="py-3.5">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#F4D03F] text-[#050505] font-extrabold text-xs flex items-center justify-center">
                          {m.name?.[0]?.toUpperCase() || "U"}
                        </div>
                        <div>
                          <p className="font-bold text-white">{m.name}</p>
                          <p className="text-neutral-400 text-[11px]">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          m.role === "owner"
                            ? "bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30"
                            : m.role === "admin"
                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/30"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        }`}
                      >
                        {m.role}
                      </span>
                    </td>
                    <td className="py-3.5 text-neutral-400">
                      {new Date(m.joined_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 text-right">
                      {m.role === "owner" ? (
                        <span className="text-[10px] text-neutral-500 italic">Workspace Owner</span>
                      ) : (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          className="bg-[#050505] border border-[#222222] text-xs text-neutral-300 rounded-lg px-2 py-1 focus:outline-none focus:border-[#D4AF37]"
                        >
                          <option value="admin">Make Admin</option>
                          <option value="agent">Make Agent</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Member Dialog Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#222222] pb-3">
              <h3 className="text-base font-bold text-white">Invite Team Member</h3>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Member Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-white text-sm focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  Assign Access Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-white text-sm focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value="agent">Agent (Operator Inbox Access)</option>
                  <option value="admin">Admin (Full Team & Config Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#222222]">
                <button
                  type="button"
                  onClick={() => setInviteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-xs font-semibold text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] text-xs font-extrabold hover:brightness-110 disabled:opacity-50"
                >
                  {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

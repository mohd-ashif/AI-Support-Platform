"use client";

import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { apiFetch } from "@/lib/api";
import { Settings, Key, Plus, Trash2, Copy, Check, Eye, EyeOff, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  const { selectedWorkspace } = useSelector((state: RootState) => state.auth);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, [selectedWorkspace]);

  const fetchApiKeys = async () => {
    try {
      const data = await apiFetch("/settings/api-keys");
      setApiKeys(data || []);
    } catch (e) {
      setApiKeys([]);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetch("/settings/api-keys", {
        method: "POST",
        body: JSON.stringify({ label: newKeyLabel.trim() }),
      });
      setCreatedRawKey(res.raw_key);
      setNewKeyLabel("");
      fetchApiKeys();
    } catch (err: any) {
      alert(err.message || "Failed to create API key.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm("Are you sure you want to revoke this API key? This action cannot be undone.")) return;
    try {
      await apiFetch(`/settings/api-keys/${keyId}`, { method: "DELETE" });
      fetchApiKeys();
    } catch (err: any) {
      alert(err.message || "Failed to revoke API key.");
    }
  };

  const handleCopyRawKey = () => {
    if (!createdRawKey) return;
    navigator.clipboard.writeText(createdRawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="pb-4 border-b border-[#1F1F1F]">
        <div className="flex items-center space-x-2">
          <Settings className="h-6 w-6 text-[#D4AF37]" />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Workspace & Developer Settings</h1>
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          Configure API credentials, secret keys, and security parameters for your workspace.
        </p>
      </div>

      {/* One-Time Raw API Key Reveal Modal / Banner */}
      {createdRawKey && (
        <div className="bg-[#111111] border border-[#D4AF37] rounded-2xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95">
          <div className="flex items-center space-x-2 text-[#D4AF37]">
            <ShieldCheck className="h-5 w-5" />
            <h3 className="text-sm font-extrabold">Save Your API Key Now (One-Time View Only)</h3>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            Please copy your secret key now. <strong className="text-amber-400">You will not be able to see it again!</strong>
          </p>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={createdRawKey}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs font-mono text-[#D4AF37]"
            />
            <button
              type="button"
              onClick={handleCopyRawKey}
              className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs hover:brightness-110 flex items-center space-x-1.5 shrink-0"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? "Copied!" : "Copy Secret Key"}</span>
            </button>
            <button
              type="button"
              onClick={() => setCreatedRawKey(null)}
              className="px-4 py-2.5 rounded-xl bg-[#1A1A1A] border border-[#2B2B2B] text-neutral-300 font-bold text-xs hover:text-white"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Create New API Key */}
      <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
          <div className="flex items-center space-x-2">
            <Key className="h-5 w-5 text-[#D4AF37]" />
            <h3 className="text-sm font-bold text-white">Developer API Keys</h3>
          </div>
        </div>

        <form onSubmit={handleCreateKey} className="flex items-center space-x-3">
          <input
            type="text"
            placeholder="Key Label (e.g. Staging Server, Production Service)"
            value={newKeyLabel}
            onChange={(e) => setNewKeyLabel(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
          />
          <button
            type="submit"
            disabled={loading || !newKeyLabel.trim()}
            className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs hover:brightness-110 disabled:opacity-50 flex items-center space-x-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Generate New Key</span>
          </button>
        </form>

        {/* Existing API Keys Table */}
        <div className="pt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-neutral-500 border-b border-[#1A1A1A]">
                <th className="pb-3 font-semibold">Label</th>
                <th className="pb-3 font-semibold">Key Prefix</th>
                <th className="pb-3 font-semibold">Created At</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-neutral-500">
                    No active API keys found. Generate a key above to access the Developer API.
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-[#141414] transition-colors">
                    <td className="py-3 font-semibold text-white">{key.label}</td>
                    <td className="py-3 font-mono text-[#D4AF37]">{key.key_prefix}</td>
                    <td className="py-3 text-neutral-400">{key.created_at ? new Date(key.created_at).toLocaleDateString() : "-"}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          key.revoked
                            ? "bg-red-500/10 text-red-400 border border-red-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {key.revoked ? "Revoked" : "Active"}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {!key.revoked && (
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(key.id)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Revoke Key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
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


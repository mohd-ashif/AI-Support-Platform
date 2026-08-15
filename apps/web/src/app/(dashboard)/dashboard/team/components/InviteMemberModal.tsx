import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/ui/FormField";
import { UserPlus, Loader2 } from "lucide-react";

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: "admin" | "agent") => Promise<void>;
  loading: boolean;
  error?: string | null;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading,
  error,
}) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    await onSubmit(email.trim(), role);
    setEmail("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Invite Team Member"
      description="Send an email invitation link to join your SupportAI workspace."
      icon={UserPlus}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-xs font-semibold text-neutral-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="invite-member-form"
            disabled={loading || !email.trim()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] text-xs font-extrabold hover:brightness-110 disabled:opacity-50 flex items-center space-x-1.5"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{loading ? "Sending..." : "Send Invitation"}</span>
          </button>
        </>
      }
    >
      <form id="invite-member-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Member Email Address" error={error} required>
          <input
            type="email"
            required
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-white text-sm focus:outline-none focus:border-[#D4AF37]"
          />
        </FormField>

        <FormField label="Assign Access Role" required>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            className="w-full px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-white text-sm focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="agent">Agent (Operator Inbox Access)</option>
            <option value="admin">Admin (Full Team & Config Access)</option>
          </select>
        </FormField>
      </form>
    </Modal>
  );
};

import React from "react";
import { TeamMember } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/utils/format";
import { Users } from "lucide-react";

interface TeamTableProps {
  members: TeamMember[];
  loading: boolean;
  onRoleChange: (memberId: string, newRole: string) => void;
  workspaceId?: string;
}

export const TeamTable: React.FC<TeamTableProps> = ({
  members,
  loading,
  onRoleChange,
  workspaceId,
}) => {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-2xl">
      <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
        <h3 className="text-sm font-bold text-white">Active Workspace Members ({members.length})</h3>
        <span className="text-xs text-neutral-500 font-mono">Workspace ID: {workspaceId || "N/A"}</span>
      </div>

      {loading && members.length === 0 ? (
        <table className="w-full text-left text-xs">
          <TableSkeleton columns={4} rows={3} />
        </table>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members in workspace"
          description="Invite team members to collaborate and handle support requests."
        />
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
                    <StatusBadge status={m.role} label={m.role} />
                  </td>
                  <td className="py-3.5 text-neutral-400">{formatDate(m.joined_at)}</td>
                  <td className="py-3.5 text-right">
                    {m.role === "owner" ? (
                      <span className="text-[10px] text-neutral-500 italic">Workspace Owner</span>
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) => onRoleChange(m.id, e.target.value)}
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
  );
};

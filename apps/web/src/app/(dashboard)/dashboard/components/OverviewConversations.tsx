import React from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TableSkeleton } from "@/components/ui/TableSkeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageSquare } from "lucide-react";

export interface ConversationItem {
  id: string;
  visitor?: string;
  visitor_id?: string;
  topic?: string;
  last_message_preview?: string | null;
  status: string;
  time?: string;
  last_message_at?: string | null;
  created_at?: string;
}

interface OverviewConversationsProps {
  conversations: ConversationItem[];
  loading: boolean;
}

export const OverviewConversations: React.FC<OverviewConversationsProps> = ({ conversations, loading }) => {
  return (
    <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4 shadow-2xl">
      <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
        <h3 className="text-sm font-bold text-neutral-200">Recent Customer Support Conversations</h3>
        <a href="/dashboard/inbox" className="text-xs text-[#D4AF37] font-semibold hover:underline">
          View All Inbox ↗
        </a>
      </div>

      {loading && conversations.length === 0 ? (
        <table className="w-full text-left text-xs">
          <TableSkeleton columns={4} rows={3} />
        </table>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No recent conversations recorded"
          description="Customer interactions will appear here automatically when visitors engage with your widget."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-neutral-500 border-b border-[#1A1A1A]">
                <th className="pb-3 font-semibold">Visitor</th>
                <th className="pb-3 font-semibold">Topic / Question</th>
                <th className="pb-3 font-semibold">Resolution Status</th>
                <th className="pb-3 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1A1A]">
              {conversations.map((c) => {
                const visitorLabel =
                  c.visitor ||
                  (c.visitor_id
                    ? c.visitor_id.startsWith("visitor_") || c.visitor_id.length > 12
                      ? `Visitor #${c.visitor_id.slice(-6)}`
                      : c.visitor_id
                    : "Anonymous Visitor");
                const topicLabel = c.topic || c.last_message_preview || "General Inquiry";
                const timeLabel =
                  c.time ||
                  (c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Just now");

                return (
                  <tr key={c.id} className="hover:bg-[#141414] transition-colors">
                    <td className="py-3 font-semibold text-white">{visitorLabel}</td>
                    <td className="py-3 text-neutral-300">{topicLabel}</td>
                    <td className="py-3">
                      <StatusBadge status={c.status} label={c.status} />
                    </td>
                    <td className="py-3 text-right text-neutral-500">{timeLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

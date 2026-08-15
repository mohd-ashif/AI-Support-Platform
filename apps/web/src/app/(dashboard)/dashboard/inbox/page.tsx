"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  useConversations,
  useMessages,
  useSendMessageMutation,
  useTakeoverConversationMutation,
  useResolveConversationMutation,
} from "@/hooks/queries/useInboxQueries";
import { inboxService, Conversation, Message } from "@/services/inboxService";
import { useToast } from "@/components/ui/ToastProvider";
import { MessageSquare, Bot, User, Send, CheckCircle2, ShieldAlert, Loader2, RefreshCw } from "lucide-react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export default function LiveInboxPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { selectedWorkspace, accessToken } = useSelector((state: RootState) => state.auth);
  const activeWsId = selectedWorkspace?.id;

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const { data: rawConvs, isLoading: loadingConvs } = useConversations(activeWsId);
  const conversations: Conversation[] = Array.isArray(rawConvs) ? rawConvs : (rawConvs as any)?.items || [];
  const { data: rawMessages = [], isLoading: loadingMessages } = useMessages(selectedConvId, activeWsId);
  const messages: Message[] = Array.isArray(rawMessages) ? rawMessages : (rawMessages as any)?.items || [];

  const sendMessageMutation = useSendMessageMutation(activeWsId);
  const takeoverMutation = useTakeoverConversationMutation(activeWsId);
  const resolveMutation = useResolveConversationMutation(activeWsId);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (conversations.length > 0 && !selectedConvId) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  // Socket.io realtime subscription
  useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const socket = io(API_URL, {
      transports: ["websocket", "polling"],
      auth: { token: accessToken },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (activeWsId) {
        socket.emit("join_workspace", { workspace_id: activeWsId });
      }
    });

    socket.on("message:new", (msg: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(activeWsId) });
      if (selectedConvId && msg.conversation_id === selectedConvId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.inbox.messages(selectedConvId) });
      }
    });

    socket.on("conversation:assigned", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(activeWsId) });
    });

    socket.on("conversation:resolved", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(activeWsId) });
    });

    return () => {
      socket.disconnect();
    };
  }, [activeWsId, accessToken, selectedConvId, queryClient]);

  useEffect(() => {
    if (selectedConvId && socketRef.current) {
      socketRef.current.emit("join_conversation", { conversation_id: selectedConvId });
    }
  }, [selectedConvId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

  const handleTakeOver = async () => {
    if (!selectedConvId) return;
    try {
      await takeoverMutation.mutateAsync(selectedConvId);
      toast.success("Human operator takeover initiated for session.");
    } catch (err: any) {
      toast.error(err.message || "Failed to take over session.");
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !replyText.trim() || sendMessageMutation.isPending) return;

    const content = replyText.trim();
    setReplyText("");
    try {
      await sendMessageMutation.mutateAsync({ conversationId: selectedConvId, content });
      toast.success("Reply dispatched to customer!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message. Make sure session is assigned to you.");
      setReplyText(content);
    }
  };

  const handleResolve = async () => {
    if (!selectedConvId) return;
    try {
      await resolveMutation.mutateAsync(selectedConvId);
      toast.success("Conversation marked as resolved.");
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve conversation.");
    }
  };

  const handleClearPreviewChats = async () => {
    try {
      await inboxService.clearPreviewChats(activeWsId);
      setSelectedConvId(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(activeWsId) });
      toast.info("Cleared test preview chat threads.");
    } catch (e: any) {
      toast.error(e.message || "Failed to clear preview chats.");
    }
  };

  const currentConv = conversations.find((c: Conversation) => c.id === selectedConvId);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="pb-4 border-b border-[#1F1F1F]">
        <div className="flex items-center space-x-2">
          <MessageSquare className="h-6 w-6 text-[#D4AF37]" />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Live Operator Inbox</h1>
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          Monitor incoming customer sessions, view AI support resolution logs, and perform human operator takeover.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[520px]">
        {/* Active Conversations Panel */}
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-4 space-y-3 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              Conversations ({conversations.length})
            </span>
            <div className="flex items-center space-x-2">
              {conversations.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearPreviewChats}
                  className="text-[10px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold transition-all"
                  title="Clear old test preview threads"
                >
                  Clear Test Chats
                </button>
              )}
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold animate-pulse">
                Live Stream
              </span>
            </div>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto max-h-[560px]">
            {loadingConvs ? (
              <div className="p-6 text-center text-xs text-neutral-400 flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
                <span>Loading live sessions...</span>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500 bg-[#050505] rounded-xl border border-[#1A1A1A]">
                No active conversations yet. Send a message via the widget to start receiving messages live.
              </div>
            ) : (
              conversations.map((c: Conversation) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedConvId(c.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-all space-y-1 border ${
                    selectedConvId === c.id
                      ? "bg-[#1A1A1A] border-[#D4AF37] text-white shadow-md shadow-[#D4AF37]/10"
                      : "bg-[#050505] border-[#222222] hover:border-[#333333] text-neutral-300"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold truncate">
                      {c.visitor_id ? `Visitor #${c.visitor_id.substring(0, 8)}` : "Customer Session"}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                        c.status === "human"
                          ? "bg-amber-500/20 text-amber-400"
                          : c.status === "resolved"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 truncate">{c.last_message_preview || "Active session..."}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Chat Message View Panel */}
        <div className="lg:col-span-2 bg-[#111111] border border-[#222222] rounded-2xl p-4 flex flex-col justify-between space-y-4">
          {!selectedConvId || !currentConv ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-2 text-neutral-500">
              <Bot className="h-10 w-10 text-[#D4AF37]/40" />
              <p className="text-xs font-semibold">Select an active conversation to view real-time transcript logs</p>
            </div>
          ) : (
            <>
              {/* Conversation Control Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#222222]">
                <div className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-[#D4AF37]" />
                  <div>
                    <h3 className="text-xs font-bold text-white">Visitor #{currentConv.visitor_id.substring(0, 8)}</h3>
                    <p className="text-[10px] text-neutral-400">Status: {currentConv.status.toUpperCase()}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {currentConv.status !== "human" && (
                    <button
                      type="button"
                      onClick={handleTakeOver}
                      disabled={takeoverMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center space-x-1 disabled:opacity-50"
                    >
                      {takeoverMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      )}
                      <span>Take Over Conversation</span>
                    </button>
                  )}

                  {currentConv.status !== "resolved" && (
                    <button
                      type="button"
                      onClick={handleResolve}
                      disabled={resolveMutation.isPending}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center space-x-1 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Resolve</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Message History Transcript */}
              <div ref={messagesEndRef} className="flex-1 overflow-y-auto space-y-3 pr-2 max-h-[380px]">
                {loadingMessages ? (
                  <div className="p-6 text-center text-xs text-neutral-400 flex items-center justify-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
                    <span>Loading transcript history...</span>
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-neutral-500 text-center py-6">No messages recorded in transcript.</p>
                ) : (
                  messages.map((m: Message) => {
                    const isUser = m.sender_type === "visitor";
                    const isBot = m.sender_type === "bot";
                    return (
                      <div key={m.id} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`max-w-[75%] rounded-xl p-3 text-xs space-y-1 ${
                            isUser
                              ? "bg-[#1F1F1F] text-neutral-200"
                              : isBot
                              ? "bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-white"
                              : "bg-emerald-500/20 text-white border border-emerald-500/30"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] opacity-75 mb-1">
                            <span className="font-bold">{isUser ? "Visitor" : isBot ? "AI Assistant" : "Operator"}</span>
                            <span>{m.created_at ? new Date(m.created_at).toLocaleTimeString() : ""}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reply Input Box */}
              <form onSubmit={handleSendReply} className="flex items-center space-x-2 pt-2 border-t border-[#222222]">
                <input
                  type="text"
                  placeholder={
                    currentConv.status === "human"
                      ? "Type human operator response..."
                      : "Take over session first to reply manually"
                  }
                  disabled={currentConv.status !== "human" || sendMessageMutation.isPending}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={currentConv.status !== "human" || !replyText.trim() || sendMessageMutation.isPending}
                  className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-black font-bold text-xs hover:brightness-110 disabled:opacity-50 transition-all flex items-center space-x-1.5"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>Send</span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

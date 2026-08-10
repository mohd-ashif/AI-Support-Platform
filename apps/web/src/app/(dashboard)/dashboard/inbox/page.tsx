"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { apiFetch } from "@/lib/api";
import { MessageSquare, Bot, User, Send, CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";

import { io, Socket } from "socket.io-client";

export default function LiveInboxPage() {
  const { selectedWorkspace, accessToken } = useSelector((state: RootState) => state.auth);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initial fetch + Socket.io realtime subscription (Zero Polling)
  useEffect(() => {
    fetchConversations();

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const socket = io(API_URL, {
      transports: ["websocket", "polling"],
      auth: { token: accessToken },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (selectedWorkspace?.id) {
        socket.emit("join_workspace", { workspace_id: selectedWorkspace.id });
      }
    });

    socket.on("message:new", (msg: any) => {
      // Update conversations list preview
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === msg.conversation_id);
        if (exists) {
          return prev.map((c) =>
            c.id === msg.conversation_id
              ? { ...c, last_message_preview: msg.content.substring(0, 60), last_message_at: msg.created_at }
              : c
          );
        } else {
          return [
            {
              id: msg.conversation_id,
              workspace_id: msg.workspace_id,
              visitor_id: msg.visitor_id || "new_session",
              status: "bot",
              last_message_preview: msg.content.substring(0, 60),
              last_message_at: msg.created_at,
            },
            ...prev,
          ];
        }
      });

      // Append to active message transcript if selected
      setMessages((prev) => {
        if (msg.conversation_id === selectedConvId && !prev.some((m) => m.id === msg.id)) {
          return [...prev, msg];
        }
        return prev;
      });
    });

    socket.on("conversation:assigned", (evt: any) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === evt.conversation_id ? { ...c, status: evt.status } : c))
      );
    });

    socket.on("conversation:resolved", (evt: any) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === evt.conversation_id ? { ...c, status: "resolved" } : c))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedWorkspace, accessToken]);

  useEffect(() => {
    if (selectedConvId) {
      fetchMessages(selectedConvId);
      if (socketRef.current) {
        socketRef.current.emit("join_conversation", { conversation_id: selectedConvId });
      }
    } else {
      setMessages([]);
    }
  }, [selectedConvId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await apiFetch("/conversations");
      const items = res.items || [];
      setConversations(items);
      if (items.length > 0 && !selectedConvId) {
        setSelectedConvId(items[0].id);
      }
    } catch (e) {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  };



  const fetchMessages = async (convId: string) => {
    try {
      const res = await apiFetch(`/conversations/${convId}/messages`);
      setMessages(res || []);
    } catch (e) {}
  };

  const handleTakeOver = async () => {
    if (!selectedConvId) return;
    setTakingOver(true);
    try {
      await apiFetch(`/conversations/${selectedConvId}/assign`, {
        method: "POST",
        body: JSON.stringify({ force: true }),
      });
      fetchConversations();
    } catch (err: any) {
      alert(err.message || "Failed to take over session.");
    } finally {
      setTakingOver(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConvId || !replyText.trim() || sending) return;
    setSending(true);
    try {
      await apiFetch(`/conversations/${selectedConvId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: replyText.trim() }),
      });
      setReplyText("");
      fetchMessages(selectedConvId);
    } catch (err: any) {
      alert(err.message || "Failed to send message. Make sure session is assigned to you.");
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedConvId) return;
    try {
      await apiFetch(`/conversations/${selectedConvId}/resolve`, { method: "POST" });
      fetchConversations();
    } catch (e) {}
  };

  const handleClearPreviewChats = async () => {
    try {
      await apiFetch("/conversations/clear-preview", { method: "DELETE" });
      setSelectedConvId(null);
      setMessages([]);
      fetchConversations();
    } catch (e) {}
  };

  const currentConv = conversations.find((c) => c.id === selectedConvId);

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

          <div className="space-y-2 flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500 bg-[#050505] rounded-xl border border-[#1A1A1A]">
                No active conversations yet. Send a message via the widget to start receiving messages live.
              </div>
            ) : (
              conversations.map((c) => (
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
                  <p className="text-[11px] text-neutral-400 truncate">
                    {c.last_message_preview || "Active support thread..."}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Chat & Takeover Workspace */}
        <div className="lg:col-span-2 bg-[#111111] border border-[#222222] rounded-2xl p-6 flex flex-col justify-between space-y-4">
          {currentConv ? (
            <>
              <div className="flex items-center justify-between pb-4 border-b border-[#222222]">
                <div className="flex items-center space-x-3">
                  <div className="h-8 w-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-[#D4AF37]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Visitor #{currentConv.visitor_id?.substring(0, 8) || "Session"}
                    </h3>
                    <p className="text-[10px] text-neutral-400">
                      Status: <span className="text-[#D4AF37] font-semibold">{currentConv.status}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {currentConv.status !== "resolved" && (
                    <button
                      type="button"
                      onClick={handleResolve}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center space-x-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Resolve</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleTakeOver}
                    disabled={takingOver}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-all flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {takingOver ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    )}
                    <span>{currentConv.status === "human" ? "Claimed" : "Take Over Session"}</span>
                  </button>
                </div>
              </div>

              {/* Chat transcript */}
              <div
                ref={messagesEndRef}
                className="flex-1 bg-[#050505] border border-[#1F1F1F] rounded-xl p-4 space-y-3 min-h-[320px] max-h-[420px] overflow-y-auto"
              >
                {messages.length === 0 ? (
                  <div className="text-center text-xs text-neutral-500 pt-12">Loading transcript...</div>
                ) : (
                  messages.map((m) => {
                    const isVisitor = m.sender_type === "visitor";
                    const isAgent = m.sender_type === "agent";
                    return (
                      <div
                        key={m.id}
                        className={`flex items-start space-x-2 ${
                          isVisitor ? "justify-start" : "justify-end"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-xl p-3 text-xs leading-relaxed ${
                            isVisitor
                              ? "bg-[#141414] border border-[#222222] text-neutral-200"
                              : isAgent
                              ? "bg-[#D4AF37] text-black font-semibold"
                              : "bg-[#1F1F1F] border border-[#2A2A2A] text-neutral-300"
                          }`}
                        >
                          <div className="text-[9px] opacity-70 mb-0.5 font-bold uppercase tracking-wider">
                            {m.sender_type}
                          </div>
                          {m.content}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Operator Reply Box */}
              <form onSubmit={handleSendReply} className="flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Type your response as human operator..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  disabled={sending || !replyText.trim()}
                  className="p-2.5 rounded-xl bg-[#D4AF37] text-black font-bold hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 text-xs space-y-2">
              <MessageSquare className="h-8 w-8 text-neutral-600" />
              <span>Select an active conversation thread from the left panel to inspect transcript.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useNotificationStore, NotificationItem } from "@/stores/useNotificationStore";
import {
  useNotifications,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useClearNotificationsMutation,
} from "@/hooks/queries/useNotificationQueries";
import {
  Bell,
  MessageSquare,
  BookOpen,
  BarChart3,
  Sparkles,
  CheckCheck,
  Trash2,
  X,
  Loader2,
} from "lucide-react";

function formatTimeAgo(isoDateStr: string): string {
  try {
    const diffMs = Date.now() - new Date(isoDateStr).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "Recently";
  }
}

export const NotificationPopover: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const activeWsId = selectedWorkspace?.id;

  const { data: dbNotifications = [], isLoading } = useNotifications(activeWsId);
  const markReadMutation = useMarkNotificationReadMutation(activeWsId);
  const markAllReadMutation = useMarkAllNotificationsReadMutation(activeWsId);
  const clearMutation = useClearNotificationsMutation(activeWsId);

  const localNotifications = useNotificationStore((state) => state.notifications);
  const markLocalRead = useNotificationStore((state) => state.markAsRead);
  const markAllLocalRead = useNotificationStore((state) => state.markAllAsRead);
  const clearLocal = useNotificationStore((state) => state.clearAll);

  // Combine DB notifications with real-time Socket items, removing duplicates by ID
  const dbItems: NotificationItem[] = dbNotifications.map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: (n.type as any) || "system",
    timestamp: n.created_at,
    read: n.read,
    action_url: n.action_url || undefined,
  }));

  const combinedMap = new Map<string, NotificationItem>();
  dbItems.forEach((item) => combinedMap.set(item.id, item));
  localNotifications.forEach((item) => {
    if (!combinedMap.has(item.id)) combinedMap.set(item.id, item);
  });

  const notifications = Array.from(combinedMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    markLocalRead(id);
    markReadMutation.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllLocalRead();
    markAllReadMutation.mutate();
  };

  const handleClearAll = () => {
    clearLocal();
    clearMutation.mutate();
  };

  // Auto-close popover on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const getCategoryIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "chat":
        return <MessageSquare className="h-4 w-4 text-emerald-400 shrink-0" />;
      case "knowledge":
        return <BookOpen className="h-4 w-4 text-indigo-400 shrink-0" />;
      case "analytics":
        return <BarChart3 className="h-4 w-4 text-amber-400 shrink-0" />;
      case "system":
      default:
        return <Sparkles className="h-4 w-4 text-[#D4AF37] shrink-0" />;
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-xl bg-[#141414] border border-[#222222] text-neutral-300 hover:text-white hover:border-[#D4AF37]/40 active:scale-95 transition-all relative"
        title="Notifications Panel"
      >
        <Bell className="h-4 w-4 text-neutral-300 hover:text-[#D4AF37] transition-colors" />

        {/* Unread Counter Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-black text-[9px] flex items-center justify-center shadow-[0_0_8px_#D4AF37]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#111111] border border-[#262626] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Popover Header */}
          <div className="p-4 border-b border-[#1F1F1F] flex items-center justify-between bg-[#0A0A0A]">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-extrabold text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-bold">
                  {unreadCount} New
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={markAllReadMutation.isPending}
                  className="text-[11px] text-[#D4AF37] hover:underline font-semibold flex items-center space-x-1 disabled:opacity-50"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Read all</span>
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={clearMutation.isPending}
                  className="text-neutral-500 hover:text-red-400 p-1 rounded-lg transition-colors disabled:opacity-50"
                  title="Clear notifications"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-neutral-500 hover:text-white p-1 rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notifications Scrollable List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[#1A1A1A]">
            {isLoading ? (
              <div className="p-8 text-center space-y-2">
                <Loader2 className="h-6 w-6 text-[#D4AF37] animate-spin mx-auto" />
                <p className="text-xs text-neutral-400">Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Bell className="h-8 w-8 text-neutral-600 mx-auto" />
                <p className="text-xs text-neutral-400 font-semibold">No active notifications</p>
                <p className="text-[11px] text-neutral-600">
                  Real-time events will populate here when customer chat inquiries arrive.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const Icon = getCategoryIcon(item.type);

                const content = (
                  <div
                    onClick={() => {
                      if (!item.read) handleMarkAsRead(item.id);
                    }}
                    className={`p-3.5 flex items-start space-x-3 transition-colors text-left cursor-pointer ${
                      !item.read
                        ? "bg-[#161616] hover:bg-[#1A1A1A]"
                        : "hover:bg-[#141414] opacity-80"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-[#1F1F1F] border border-[#2B2B2B] shrink-0 mt-0.5">
                      {Icon}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-white truncate">{item.title}</p>
                        <span className="text-[10px] text-neutral-500 shrink-0 ml-2">
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-300 leading-snug line-clamp-2">
                        {item.message}
                      </p>
                    </div>

                    {!item.read && (
                      <span className="h-2 w-2 rounded-full bg-[#D4AF37] shrink-0 mt-1 shadow-[0_0_6px_#D4AF37]" />
                    )}
                  </div>
                );

                return item.action_url ? (
                  <Link key={item.id} href={item.action_url} onClick={() => setIsOpen(false)}>
                    {content}
                  </Link>
                ) : (
                  <div key={item.id}>{content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

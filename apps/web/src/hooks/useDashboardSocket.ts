import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { useNotificationStore } from "@/stores/useNotificationStore";
import { io, Socket } from "socket.io-client";

function triggerBrowserNotification(title: string, body: string) {
  if (typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/favicon.ico" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, { body, icon: "/favicon.ico" });
        }
      });
    }
  }
}

export function useDashboardSocket() {
  const queryClient = useQueryClient();
  const { selectedWorkspace, accessToken } = useSelector((state: RootState) => state.auth);
  const activeWsId = selectedWorkspace?.id;
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!activeWsId) return;

    // Request browser notification permission once on mount
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const socket = io(API_URL, {
      transports: ["websocket", "polling"],
      auth: { token: accessToken },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_workspace", { workspace_id: activeWsId });
    });

    socket.on("notification_created", (data: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      if (data?.title && data?.message) {
        triggerBrowserNotification(data.title, data.message);
      }
    });

    socket.on("conversation_created", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(activeWsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });

      useNotificationStore.getState().addNotification({
        title: "New Customer Conversation",
        message: "A visitor initiated a new chat session with your AI agent.",
        type: "chat",
        action_url: "/dashboard/inbox",
      });

      triggerBrowserNotification("New Customer Chat Started", "A visitor initiated a support conversation.");
    });

    socket.on("conversation_updated", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(activeWsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    });

    socket.on("new_message", (data: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(activeWsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });

      const contentSnippet = data?.content ? `: "${data.content.slice(0, 40)}..."` : "";
      useNotificationStore.getState().addNotification({
        title: "New Visitor Message",
        message: `Inbound customer inquiry received${contentSnippet}`,
        type: "chat",
        action_url: "/dashboard/inbox",
      });

      triggerBrowserNotification("New Support Message", `Inbound customer message received${contentSnippet}`);
    });

    socket.on("analytics_updated", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    });

    socket.on("source_indexed", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.web(activeWsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.files(activeWsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });

      useNotificationStore.getState().addNotification({
        title: "Knowledge Source Indexed",
        message: "Content processing and RAG vector embedding completed successfully.",
        type: "knowledge",
        action_url: "/dashboard/knowledge",
      });

      triggerBrowserNotification("RAG Vector Index Complete", "Knowledge base source is now active for AI resolution.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeWsId, accessToken, queryClient]);
}

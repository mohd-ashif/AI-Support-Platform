import { useEffect, useRef } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { io, Socket } from "socket.io-client";

export function useDashboardSocket() {
  const queryClient = useQueryClient();
  const { selectedWorkspace, accessToken } = useSelector((state: RootState) => state.auth);
  const activeWsId = selectedWorkspace?.id;
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!activeWsId) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const socket = io(API_URL, {
      transports: ["websocket", "polling"],
      auth: { token: accessToken },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_workspace", { workspace_id: activeWsId });
    });

    socket.on("conversation_created", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(activeWsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    });

    socket.on("conversation_updated", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(activeWsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    });

    socket.on("new_message", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(activeWsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    });

    socket.on("analytics_updated", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    });

    socket.on("source_indexed", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.web(activeWsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.files(activeWsId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeWsId, accessToken, queryClient]);
}

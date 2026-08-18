import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inboxService } from "@/services/inboxService";
import { queryKeys } from "@/lib/queryKeys";

export function useConversations(workspaceId?: string) {
  return useQuery({
    queryKey: queryKeys.inbox.conversations(workspaceId),
    queryFn: () => inboxService.getConversations(workspaceId),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useMessages(conversationId: string | null, workspaceId?: string) {
  return useQuery({
    queryKey: queryKeys.inbox.messages(conversationId || "none"),
    queryFn: () => inboxService.getMessages(conversationId!, workspaceId),
    enabled: Boolean(conversationId),
    staleTime: 10 * 1000,
    retry: 1,
  });
}

export function useSendMessageMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      inboxService.sendMessage(conversationId, content, workspaceId),
    onSuccess: (newMessage, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.messages(conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(workspaceId) });
    },
  });
}

export function useTakeoverConversationMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => inboxService.takeoverConversation(conversationId, workspaceId),
    onSuccess: (updatedConv) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(workspaceId) });
    },
  });
}

export function useResolveConversationMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => inboxService.resolveConversation(conversationId, workspaceId),
    onSuccess: (updatedConv) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(workspaceId) });
    },
  });
}

// Aliases for live inbox feature integration
export const useConversationsQuery = useConversations;
export const useConversationDetailQuery = (conversationId?: string | null, workspaceId?: string) =>
  useMessages(conversationId || null, workspaceId);
export const useAssignAgentMutation = (workspaceId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, force }: { conversationId: string; force?: boolean }) =>
      inboxService.takeoverConversation(conversationId, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox.conversations(workspaceId) });
    },
  });
};


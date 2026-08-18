import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  useConversationsQuery,
  useConversationDetailQuery,
  useSendMessageMutation,
  useAssignAgentMutation,
} from "@/hooks/queries/useInboxQueries";

/**
 * Unified Live Inbox & Conversation Management Feature Hook.
 */
export function useConversations(conversationId?: string, workspaceId?: string) {
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const activeWsId = workspaceId || selectedWorkspace?.id;

  const { data: conversations = [], isLoading: loadingList, refetch: refetchList } =
    useConversationsQuery(activeWsId);

  const { data: conversationDetail, isLoading: loadingDetail } =
    useConversationDetailQuery(conversationId, activeWsId);

  const sendMutation = useSendMessageMutation(activeWsId);
  const assignMutation = useAssignAgentMutation(activeWsId);

  const sendMessage = async (content: string) => {
    if (!conversationId) throw new Error("Conversation ID required to send message");
    return sendMutation.mutateAsync({ conversationId, content });
  };

  const assignAgent = async (targetConvId: string, force: boolean = false) => {
    return assignMutation.mutateAsync({ conversationId: targetConvId, force });
  };

  return {
    conversations,
    conversationDetail,
    isLoading: loadingList || loadingDetail,
    isSending: sendMutation.isPending,
    isAssigning: assignMutation.isPending,
    sendMessage,
    assignAgent,
    refetchList,
  };
}

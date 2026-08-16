import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService, DBNotification } from "@/services/notificationService";
import { queryKeys } from "@/lib/queryKeys";

export function useNotifications(workspaceId?: string) {
  return useQuery({
    queryKey: queryKeys.notifications.list(workspaceId),
    queryFn: () => notificationService.getNotifications(workspaceId),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useMarkNotificationReadMutation(workspaceId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useMarkAllNotificationsReadMutation(workspaceId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

export function useClearNotificationsMutation(workspaceId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.clearNotifications(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
    },
  });
}

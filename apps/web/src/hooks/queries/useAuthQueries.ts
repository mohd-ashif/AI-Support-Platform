import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authService, LoginPayload } from "@/services/authService";
import { queryKeys } from "@/lib/queryKeys";

export function useCurrentUser(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.auth.user(),
    queryFn: () => authService.getCurrentUser(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.user(), data.user);
      queryClient.setQueryData(queryKeys.workspaces.list(), data.workspaces);
    },
  });
}

export function useSignupMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { email: string; password?: string; name?: string }) => authService.register(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.auth.user(), data.user);
      queryClient.setQueryData(queryKeys.workspaces.list(), data.workspaces);
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

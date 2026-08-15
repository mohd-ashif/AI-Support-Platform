import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { billingService } from "@/services/billingService";
import { queryKeys } from "@/lib/queryKeys";

export function usePlans() {
  return useQuery({
    queryKey: queryKeys.billing.plans(),
    queryFn: () => billingService.getPlans(),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

export function useSubscription(workspaceId?: string) {
  return useQuery({
    queryKey: queryKeys.billing.subscription(workspaceId),
    queryFn: () => billingService.getSubscription(workspaceId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCheckoutMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { workspace_id: string; plan_id: string; billing_cycle: "monthly" | "annual" }) =>
      billingService.checkout(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.subscription(workspaceId) });
    },
  });
}

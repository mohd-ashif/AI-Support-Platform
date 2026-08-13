import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface Plan {
  id: string;
  name: string;
  price_monthly_cents: number;
  price_annual_cents: number;
  price_monthly_display: string;
  price_annual_display: string;
  message_limit: number;
  seat_limit: number;
  trial_days?: number | null;
  stripe_price_id_monthly?: string | null;
  stripe_price_id_annual?: string | null;
  features_json: Record<string, any>;
}

export interface Subscription {
  id?: string | null;
  workspace_id: string;
  plan_id: string;
  plan_name: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | string;
  messages_used: number;
  messages_limit: number;
  seats_used: number;
  seat_limit: number;
  price_monthly_cents: number;
  price_annual_cents: number;
  price_monthly_display: string;
  price_annual_display: string;
  stripe_customer_id?: string | null;
  stripe_sub_id?: string | null;
  current_period_end?: string | null;
  cancel_at_period_end?: boolean;
  features_json?: Record<string, any>;
}

export function usePlans() {
  return useQuery<Plan[]>({
    queryKey: ["billing", "plans"],
    queryFn: () => apiFetch("/billing/plans"),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useSubscription(workspaceId?: string) {
  const activeWsId = workspaceId || (typeof window !== "undefined" ? localStorage.getItem("workspace_id") || undefined : undefined);

  return useQuery<Subscription>({
    queryKey: ["billing", "subscription", activeWsId || "default"],
    queryFn: () =>
      apiFetch("/billing/subscription", {
        headers: activeWsId ? { "X-Workspace-Id": activeWsId } : {},
      }),
    enabled: true,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useCheckoutMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      workspace_id: string;
      plan_id: string;
      billing_cycle: "monthly" | "annual";
    }) => {
      return apiFetch("/billing/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["billing", "subscription"],
      });
    },
  });
}

import { apiFetch } from "@/lib/api";
import { Plan, Subscription } from "@/types";

export const billingService = {
  async getPlans(): Promise<Plan[]> {
    return apiFetch<Plan[]>("/billing/plans");
  },

  async getSubscription(workspaceId?: string): Promise<Subscription> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<Subscription>("/billing/subscription", { headers });
  },

  async checkout(payload: { workspace_id: string; plan_id: string; billing_cycle: "monthly" | "annual" }): Promise<{ url?: string; checkout_url?: string }> {
    return apiFetch<{ url?: string; checkout_url?: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getCheckoutStatus(sessionId: string, workspaceId: string): Promise<any> {
    const url = `/billing/checkout-status?session_id=${encodeURIComponent(sessionId)}&workspace_id=${encodeURIComponent(workspaceId)}`;
    return apiFetch(url);
  },
};

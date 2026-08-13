"use client";

import React, { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useSubscription, usePlans, useCheckoutMutation } from "@/lib/queries/billing";
import {
  CreditCard,
  CheckCircle2,
  Zap,
  Sparkles,
  Shield,
  AlertTriangle,
  Loader2,
  Check,
  Calendar,
  Users,
  MessageSquare,
  ArrowUpRight,
  RefreshCw,
} from "lucide-react";

export default function BillingPage() {
  const { selectedWorkspace } = useSelector((state: RootState) => state.auth);
  const workspaceId = selectedWorkspace?.id;

  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: sub,
    isLoading: isSubLoading,
    isError: isSubError,
    error: subError,
    refetch: refetchSub,
  } = useSubscription(workspaceId);

  const { data: plans, isLoading: isPlansLoading } = usePlans();
  const checkoutMutation = useCheckoutMutation(workspaceId);

  React.useEffect(() => {
    if (sub) {
      console.log("Subscription Response:", sub);
    }
  }, [sub]);

  const handleCheckout = React.useCallback(
    async (planId: string) => {
      if (!workspaceId) {
        setActionError("Workspace not selected.");
        return;
      }
      setActionError(null);

      try {
        const res = await checkoutMutation.mutateAsync({
          workspace_id: workspaceId,
          plan_id: planId,
          billing_cycle: billingCycle,
        });

        if (res?.redirect) {
          window.location.href = res.redirect;
        }
      } catch (err: any) {
        setActionError(err.message || "Failed to initiate subscription checkout.");
      }
    },
    [workspaceId, billingCycle, checkoutMutation]
  );

  const getStatusBadge = React.useCallback((status?: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return (
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active</span>
          </span>
        );
      case "trialing":
        return (
          <span className="px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Free Trial</span>
          </span>
        );
      case "past_due":
        return (
          <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Payment Past Due</span>
          </span>
        );
      case "canceled":
      case "cancelled":
        return (
          <span className="px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/30 text-xs font-bold uppercase tracking-wider">
            Canceled
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700 text-xs font-bold uppercase tracking-wider">
            {status || "Active"}
          </span>
        );
    }
  }, []);

  // Memoized Usage meter calculations
  const metrics = React.useMemo(() => {
    const msgUsed = sub?.messages_used ?? 0;
    const msgLimit = sub?.messages_limit ?? 100;
    const msgPercent = msgLimit === -1 ? 0 : Math.min(100, Math.round((msgUsed / (msgLimit || 1)) * 100));

    const seatsUsed = sub?.seats_used ?? 1;
    const seatsLimit = sub?.seat_limit ?? 1;
    const seatsPercent = seatsLimit === -1 ? 0 : Math.min(100, Math.round((seatsUsed / (seatsLimit || 1)) * 100));

    const formattedPeriodEnd = sub?.current_period_end
      ? new Date(sub.current_period_end).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

    return { msgUsed, msgLimit, msgPercent, seatsUsed, seatsLimit, seatsPercent, formattedPeriodEnd };
  }, [sub]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="pb-4 border-b border-[#1F1F1F] flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2.5">
            <CreditCard className="h-6 w-6 text-[#D4AF37]" />
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Billing & Subscription Tier</h1>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Manage your workspace subscription tier, seat quota, and monthly AI message usage.
          </p>
        </div>
        {workspaceId && (
          <button
            type="button"
            onClick={() => refetchSub()}
            className="p-2 rounded-xl bg-[#141414] border border-[#222] text-neutral-400 hover:text-white transition-all text-xs font-semibold flex items-center space-x-1.5"
            title="Refresh billing data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync</span>
          </button>
        )}
      </div>

      {actionError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between text-xs text-red-400">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-400 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Subscription Status Card */}
      {isSubLoading ? (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-6 animate-pulse">
          <div className="h-6 bg-[#1A1A1A] rounded-lg w-1/3" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="h-20 bg-[#1A1A1A] rounded-xl" />
            <div className="h-20 bg-[#1A1A1A] rounded-xl" />
          </div>
        </div>
      ) : isSubError ? (
        <div className="bg-[#111111] border border-red-500/20 rounded-2xl p-6 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto" />
          <h3 className="text-sm font-extrabold text-white">Unable to load billing status</h3>
          <p className="text-xs text-neutral-400">
            We encountered a problem fetching your workspace subscription details.
          </p>
          <button
            type="button"
            onClick={() => refetchSub()}
            className="px-4 py-2 rounded-xl bg-[#1C1C1C] border border-[#333] text-xs text-white font-bold hover:bg-[#262626]"
          >
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-[#111111] border border-[#D4AF37]/30 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase text-[#D4AF37] font-extrabold tracking-widest">
                Current Active Tier
              </span>
              <h2 className="text-3xl font-extrabold text-white mt-0.5">{sub?.plan_name || "Free Trial"} Plan</h2>
              {metrics.formattedPeriodEnd && (
                <div className="flex items-center space-x-1.5 mt-1 text-xs text-neutral-400">
                  <Calendar className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>
                    {sub?.status === "trialing" ? "Trial ends on " : "Renews on "}
                    <strong className="text-neutral-200">{metrics.formattedPeriodEnd}</strong>
                  </span>
                </div>
              )}
            </div>

            {getStatusBadge(sub?.status)}
          </div>

          {/* Meter Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* AI Messages Meter */}
            <div className="bg-[#050505] border border-[#222222] rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400 font-semibold flex items-center space-x-1.5">
                  <MessageSquare className="h-4 w-4 text-[#D4AF37]" />
                  <span>Monthly AI Messages</span>
                </span>
                <span className="text-white font-extrabold">
                  {metrics.msgUsed.toLocaleString()} / {metrics.msgLimit === -1 ? "Unlimited" : metrics.msgLimit.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    metrics.msgPercent > 90 ? "bg-red-500" : metrics.msgPercent > 75 ? "bg-amber-400" : "bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]"
                  }`}
                  style={{ width: metrics.msgLimit === -1 ? "100%" : `${metrics.msgPercent}%` }}
                />
              </div>
              {metrics.msgLimit !== -1 && (
                <p className="text-[10px] text-neutral-500 text-right font-bold">
                  {metrics.msgPercent}% quota consumed
                </p>
              )}
            </div>

            {/* Operator Seats Meter */}
            <div className="bg-[#050505] border border-[#222222] rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400 font-semibold flex items-center space-x-1.5">
                  <Users className="h-4 w-4 text-[#D4AF37]" />
                  <span>Seat License Quota</span>
                </span>
                <span className="text-white font-extrabold">
                  {metrics.seatsUsed} / {metrics.seatsLimit === -1 ? "Unlimited" : `${metrics.seatsLimit} Seats`}
                </span>
              </div>
              <div className="w-full h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    metrics.seatsPercent > 90 ? "bg-red-500" : "bg-gradient-to-r from-[#D4AF37] to-[#F4D03F]"
                  }`}
                  style={{ width: metrics.seatsLimit === -1 ? "100%" : `${metrics.seatsPercent}%` }}
                />
              </div>
              {metrics.seatsLimit !== -1 && (
                <p className="text-[10px] text-neutral-500 text-right font-bold">
                  {metrics.seatsPercent}% seat quota used
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Plan Selection Section */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight">Available Subscription Plans</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Upgrade or switch your workspace tier to expand message capacity and operator seats.
            </p>
          </div>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center space-x-3 bg-[#111] p-1.5 border border-[#222] rounded-xl">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                billingCycle === "monthly" ? "bg-[#222] text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                billingCycle === "annual" ? "bg-[#222] text-white" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span>Annual</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 text-[9px] font-extrabold uppercase">
                Save ~17%
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        {isPlansLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-80 bg-[#111] border border-[#222] rounded-2xl p-6 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans?.map((plan) => {
              const isCurrent = sub?.plan_id === plan.id || sub?.plan_name === plan.name;
              const isPro = plan.name === "Pro";
              const isFree = plan.name === "Free Trial" || plan.price_monthly_cents === 0;
              const priceDisplay = billingCycle === "annual" ? plan.price_annual_display : plan.price_monthly_display;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-[#111111] rounded-2xl p-6 flex flex-col justify-between space-y-6 border transition-all duration-300 ${
                    isCurrent
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : isPro
                      ? "border-[#D4AF37] shadow-lg shadow-[#D4AF37]/10"
                      : "border-[#222222] hover:border-[#333333]"
                  }`}
                >
                  {isPro && !isCurrent && (
                    <div className="absolute -top-3 left-0 right-0 mx-auto w-fit px-3 py-0.5 rounded-full bg-[#D4AF37] text-black text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                      Most Popular
                    </div>
                  )}

                  {isCurrent && (
                    <div className="absolute -top-3 left-0 right-0 mx-auto w-fit px-3 py-0.5 rounded-full bg-emerald-500 text-black text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                      Active Workspace Plan
                    </div>
                  )}

                  <div className="space-y-4 text-left">
                    <div>
                      <h3 className="text-lg font-extrabold text-white">{plan.name}</h3>
                      <div className="flex items-baseline space-x-1 mt-1">
                        <span className="text-3xl font-extrabold text-white">{priceDisplay}</span>
                        <span className="text-xs text-neutral-400">
                          {isFree ? "" : `/${billingCycle === "annual" ? "yr" : "mo"}`}
                        </span>
                      </div>
                    </div>

                    {/* Limits summary */}
                    <div className="space-y-1.5 pt-3 border-t border-[#222222] text-xs text-neutral-300">
                      <p className="font-semibold">
                        {plan.message_limit === -1 ? "Unlimited" : plan.message_limit.toLocaleString()} AI Messages / mo
                      </p>
                      <p className="text-neutral-400">
                        {plan.seat_limit === -1 ? "Unlimited" : plan.seat_limit} Operator Seat{plan.seat_limit === 1 ? "" : "s"}
                      </p>
                    </div>

                    {/* Feature Bullets */}
                    <div className="space-y-2 pt-3 border-t border-[#222222] text-xs text-neutral-400">
                      <div className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-[#D4AF37] shrink-0" />
                        <span>
                          {plan.features_json?.sources_limit === -1
                            ? "Unlimited"
                            : plan.features_json?.sources_limit || 2}{" "}
                          Knowledge Sources
                        </span>
                      </div>
                      {plan.features_json?.analytics && (
                        <div className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-[#D4AF37] shrink-0" />
                          <span>CSAT & Resolution Analytics</span>
                        </div>
                      )}
                      {plan.features_json?.api_access && (
                        <div className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-[#D4AF37] shrink-0" />
                          <span>Developer API Access</span>
                        </div>
                      )}
                      {plan.features_json?.webhooks && (
                        <div className="flex items-center space-x-2">
                          <Check className="h-4 w-4 text-[#D4AF37] shrink-0" />
                          <span>Outbound Webhooks</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <button
                    type="button"
                    onClick={() => handleCheckout(plan.id)}
                    disabled={isCurrent || checkoutMutation.isPending}
                    className={`w-full py-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center space-x-2 ${
                      isCurrent
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default"
                        : isPro
                        ? "bg-[#D4AF37] text-black hover:brightness-110 shadow-lg shadow-[#D4AF37]/20"
                        : "bg-[#1C1C1C] text-white hover:bg-[#262626] border border-[#333333]"
                    }`}
                  >
                    {checkoutMutation.isPending && checkoutMutation.variables?.plan_id === plan.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : isCurrent ? (
                      <span>Current Active Plan</span>
                    ) : isFree ? (
                      <span>Switch to Free Trial</span>
                    ) : (
                      <span>Upgrade to {plan.name}</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

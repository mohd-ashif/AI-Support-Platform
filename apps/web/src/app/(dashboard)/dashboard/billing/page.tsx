"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { useSubscription, usePlans, useCheckoutMutation } from "@/lib/queries/billing";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils/format";
import { useToast } from "@/components/ui/ToastProvider";
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
  RefreshCw,
} from "lucide-react";

import { PricingCarousel } from "./components/PricingCarousel";

export default function BillingPage() {
  const toast = useToast();
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const workspaceId = selectedWorkspace?.id;

  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: sub,
    isLoading: isSubLoading,
    isError: isSubError,
    refetch: refetchSub,
  } = useSubscription(workspaceId);

  const { data: plans = [], isLoading: isPlansLoading } = usePlans();
  const checkoutMutation = useCheckoutMutation(workspaceId);

  const handleCheckout = useCallback(
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

        const redirectUrl = res?.url || res?.checkout_url;
        if (redirectUrl) {
          toast.success("Redirecting to secure Stripe checkout...");
          window.location.href = redirectUrl;
        }
      } catch (err: any) {
        const msg = err.message || "Failed to initiate subscription checkout.";
        setActionError(msg);
        toast.error(msg);
      }
    },
    [workspaceId, billingCycle, checkoutMutation, toast]
  );

  const metrics = useMemo(() => {
    const msgUsed = sub?.messages_used ?? 0;
    const msgLimit = sub?.messages_limit ?? 100;
    const msgPercent = msgLimit === -1 ? 0 : Math.min(100, Math.round((msgUsed / (msgLimit || 1)) * 100));

    const seatsUsed = sub?.seats_used ?? 1;
    const seatsLimit = sub?.seat_limit ?? 1;
    const seatsPercent = seatsLimit === -1 ? 0 : Math.min(100, Math.round((seatsUsed / (seatsLimit || 1)) * 100));

    const formattedPeriodEnd = formatDate(sub?.current_period_end);

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

            <StatusBadge status={sub?.status || "active"} />
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
                  {formatNumber(metrics.msgUsed)} / {metrics.msgLimit === -1 ? "Unlimited" : formatNumber(metrics.msgLimit)}
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
            </div>

            {/* Team Seats Meter */}
            <div className="bg-[#050505] border border-[#222222] rounded-xl p-5 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400 font-semibold flex items-center space-x-1.5">
                  <Users className="h-4 w-4 text-[#D4AF37]" />
                  <span>Operator Team Seats</span>
                </span>
                <span className="text-white font-extrabold">
                  {metrics.seatsUsed} / {metrics.seatsLimit === -1 ? "Unlimited" : metrics.seatsLimit}
                </span>
              </div>
              <div className="w-full h-2 bg-[#1A1A1A] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] rounded-full transition-all duration-500"
                  style={{ width: metrics.seatsLimit === -1 ? "100%" : `${metrics.seatsPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plan Selector & Billing Toggle */}
      <div className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold text-white">Upgrade or Change Plan</h3>
            <p className="text-xs text-neutral-400 mt-1">Scale your AI support engine with higher message limits and seats.</p>
          </div>

          <div className="bg-[#111111] p-1 rounded-xl border border-[#222] flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                billingCycle === "monthly" ? "bg-[#D4AF37] text-black shadow-md" : "text-neutral-400 hover:text-white"
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("annual")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                billingCycle === "annual" ? "bg-[#D4AF37] text-black shadow-md" : "text-neutral-400 hover:text-white"
              }`}
            >
              <span>Annual Billing</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Plans Carousel Component */}
        {isPlansLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="bg-[#111111] border border-[#222] rounded-2xl p-6 h-96 animate-pulse" />
            ))}
          </div>
        ) : (
          <PricingCarousel
            plans={plans}
            currentPlanId={sub?.plan_id}
            currentPlanName={sub?.plan_name}
            billingCycle={billingCycle}
            isPending={checkoutMutation.isPending}
            onSelectPlan={handleCheckout}
          />
        )}
      </div>
    </div>
  );
}

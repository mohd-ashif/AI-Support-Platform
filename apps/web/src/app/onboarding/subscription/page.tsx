"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { apiFetch } from "@/lib/api";
import { Bot, Check, Sparkles, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

const DEFAULT_PLANS = [
  {
    id: "plan_free_trial",
    name: "Free Trial",
    price_monthly_cents: 0,
    price_annual_cents: 0,
    price_monthly_display: "$0",
    price_annual_display: "$0",
    message_limit: 100,
    seat_limit: 1,
    trial_days: 14,
    features_json: { sources_limit: 2, analytics: false },
  },
  {
    id: "plan_starter",
    name: "Starter",
    price_monthly_cents: 2900,
    price_annual_cents: 29000,
    price_monthly_display: "$29",
    price_annual_display: "$290",
    message_limit: 1000,
    seat_limit: 3,
    trial_days: null,
    features_json: { sources_limit: 5, analytics: true },
  },
  {
    id: "plan_pro",
    name: "Pro",
    price_monthly_cents: 9900,
    price_annual_cents: 99000,
    price_monthly_display: "$99",
    price_annual_display: "$990",
    message_limit: 5000,
    seat_limit: 10,
    trial_days: null,
    features_json: { sources_limit: 20, analytics: true, api_access: true },
  },
  {
    id: "plan_business",
    name: "Business",
    price_monthly_cents: 29900,
    price_annual_cents: 299000,
    price_monthly_display: "$299",
    price_annual_display: "$2990",
    message_limit: -1,
    seat_limit: -1,
    trial_days: null,
    features_json: { sources_limit: -1, analytics: true, api_access: true, webhooks: true },
  },
];

export default function SubscriptionSelectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedWorkspace } = useSelector((state: RootState) => state.auth);

  const [plans, setPlans] = useState<any[]>(DEFAULT_PLANS);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [showCanceledBanner, setShowCanceledBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("canceled") === "1") {
      setShowCanceledBanner(true);
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchPlans() {
      try {
        const data = await apiFetch("/billing/plans");
        if (data && data.length > 0) {
          setPlans(data);
        }
      } catch (e: any) {
        // Soft fallback to default plans
      }
    }
    fetchPlans();
  }, []);

  const handleCheckout = async (plan: any) => {
    if (!selectedWorkspace?.id) {
      setError("Please select or create a workspace first.");
      router.push("/onboarding/business");
      return;
    }

    setLoadingPlanId(plan.id);
    setError(null);

    try {
      const res = await apiFetch("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          workspace_id: selectedWorkspace.id,
          plan_id: plan.id,
          billing_cycle: billingCycle,
        }),
      });

      if (res?.redirect) {
        if (res.redirect.startsWith("http://") || res.redirect.startsWith("https://")) {
          window.location.href = res.redirect;
        } else {
          if (selectedWorkspace) {
            selectedWorkspace.status = "trialing";
          }
          window.location.href = "/dashboard";
        }
      } else {
        if (selectedWorkspace) {
          selectedWorkspace.status = "trialing";
        }
        window.location.href = "/dashboard";
      }

    } catch (err: any) {
      setError(err.message || "Failed to initiate subscription checkout.");
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 space-y-8">
      <div className="w-full max-w-5xl space-y-6 text-center">
        {/* Progress Tracker */}
        <div className="w-full max-w-lg mx-auto space-y-2">
          <div className="flex justify-between items-center text-[11px] font-bold text-neutral-400">
            <span className="text-[#D4AF37]">Step 2 of 2: Choose Plan</span>
            <span>100% Final Step</span>
          </div>
          <div className="w-full h-1.5 bg-[#1C1C1C] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] w-full transition-all duration-500 rounded-full" />
          </div>
        </div>

        {/* Brand Header */}
        <div className="space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] flex items-center justify-center shadow-xl shadow-[#D4AF37]/20">
            <Bot className="h-6 w-6 text-[#050505]" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Choose Your SupportAI Plan</h1>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            Select a plan tailored to your customer support volume. Cancel or upgrade anytime.
          </p>
        </div>

        {/* Canceled Banner */}
        {showCanceledBanner && (
          <div className="max-w-xl mx-auto p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-300">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>Checkout canceled — no charge was made. Your workspace setup remains saved.</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCanceledBanner(false)}
              className="text-amber-400 font-bold hover:underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div className="max-w-xl mx-auto p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center space-x-3 pt-2">
          <span className={`text-xs font-bold ${billingCycle === "monthly" ? "text-white" : "text-neutral-500"}`}>
            Monthly Billing
          </span>
          <button
            type="button"
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
            className="w-12 h-6 rounded-full bg-[#141414] border border-[#262626] p-1 flex items-center transition-colors relative"
          >
            <div
              className={`h-4 w-4 rounded-full bg-[#D4AF37] transition-transform duration-200 ${
                billingCycle === "annual" ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`text-xs font-bold flex items-center space-x-1.5 ${billingCycle === "annual" ? "text-white" : "text-neutral-500"}`}>
            <span>Annual Billing</span>
            <span className="px-2 py-0.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[10px] text-[#D4AF37] font-extrabold uppercase">
              Save ~17%
            </span>
          </span>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
          {plans.map((plan) => {
            const isPro = plan.name === "Pro";
            const isFree = plan.name === "Free Trial" || plan.price_monthly_cents === 0;
            const priceDisplay = billingCycle === "annual" ? plan.price_annual_display : plan.price_monthly_display;

            return (
              <div
                key={plan.id}
                className={`relative bg-[#111111] rounded-2xl p-6 flex flex-col justify-between space-y-6 border transition-all duration-300 ${
                  isPro
                    ? "border-[#D4AF37] shadow-xl shadow-[#D4AF37]/10 scale-105"
                    : "border-[#222222] hover:border-[#333333]"
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-0 right-0 mx-auto w-fit px-3 py-1 rounded-full bg-[#D4AF37] text-black text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                    Most Popular
                  </div>
                )}

                <div className="space-y-4 text-left">
                  <div>
                    <h3 className="text-lg font-extrabold text-white">{plan.name}</h3>
                    <div className="flex items-baseline space-x-1 mt-1">
                      <span className="text-3xl font-extrabold text-white">{priceDisplay}</span>
                      <span className="text-xs text-neutral-400">{isFree ? "" : `/${billingCycle === "annual" ? "yr" : "mo"}`}</span>
                    </div>
                  </div>

                  {/* Limits summary */}
                  <div className="space-y-1.5 pt-2 border-t border-[#222222] text-xs text-neutral-300">
                    <p className="font-semibold">
                      {plan.message_limit === -1 ? "Unlimited" : plan.message_limit.toLocaleString()} AI Messages / mo
                    </p>
                    <p className="text-neutral-400">
                      {plan.seat_limit === -1 ? "Unlimited" : plan.seat_limit} Operator Seat{plan.seat_limit === 1 ? "" : "s"}
                    </p>
                  </div>

                  {/* Feature Bullets */}
                  <div className="space-y-2 pt-2 border-t border-[#222222] text-xs text-neutral-400">
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
                  onClick={() => handleCheckout(plan)}
                  disabled={loadingPlanId !== null}
                  className={`w-full py-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center space-x-2 ${
                    isPro
                      ? "bg-[#D4AF37] text-black hover:brightness-110 shadow-lg shadow-[#D4AF37]/20"
                      : "bg-[#1C1C1C] text-white hover:bg-[#262626] border border-[#333333]"
                  }`}
                >
                  {loadingPlanId === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : isFree ? (
                    <span>Start 14-Day Free Trial</span>
                  ) : (
                    <span>Subscribe to {plan.name}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

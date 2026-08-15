"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { usePlans, useCheckoutMutation } from "@/hooks/queries/useBillingQueries";
import { useToast } from "@/components/ui/ToastProvider";
import { Bot, Check, Sparkles, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

export default function SubscriptionSelectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { selectedWorkspace } = useSelector((state: RootState) => state.auth);
  const activeWsId = selectedWorkspace?.id;

  const { data: plans = [], isLoading: loadingPlans } = usePlans();
  const checkoutMutation = useCheckoutMutation(activeWsId);

  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [showCanceledBanner, setShowCanceledBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("canceled") === "1") {
      setShowCanceledBanner(true);
    }
  }, [searchParams]);

  const handleCheckout = async (plan: any) => {
    if (!selectedWorkspace?.id) {
      const msg = "Please select or create a workspace first.";
      setError(msg);
      toast.error(msg);
      router.push("/onboarding/business");
      return;
    }

    setLoadingPlanId(plan.id);
    setError(null);

    try {
      const res = await checkoutMutation.mutateAsync({
        workspace_id: selectedWorkspace.id,
        plan_id: plan.id,
        billing_cycle: billingCycle,
      });

      const redirectUrl = res?.url || res?.checkout_url;
      if (redirectUrl) {
        toast.success("Redirecting to Stripe payment gateway...");
        window.location.href = redirectUrl;
      } else {
        toast.success("Trial activated! Redirecting to workspace dashboard...");
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      const msg = err.message || "Failed to initiate subscription checkout.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col justify-between p-4 sm:p-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-4 border-b border-[#1F1F1F]">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20">
            <Bot className="h-6 w-6 text-[#050505]" />
          </div>
          <span className="font-extrabold text-xl tracking-tight">
            Support<span className="text-[#D4AF37]">AI</span>
          </span>
        </div>
        <div className="text-xs font-semibold text-neutral-400">Step 2 of 2: Subscription Tier</div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto w-full my-8 space-y-6">
        {showCanceledBanner && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Checkout was canceled or incomplete. Please choose a subscription plan below to activate your workspace.
            </span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
            {error}
          </div>
        )}

        <div className="text-center space-y-3 max-w-xl mx-auto">
          <h1 className="text-3xl font-extrabold tracking-tight">Choose your workspace tier</h1>
          <p className="text-xs text-neutral-400">
            Select the capacity and AI message allowance tailored for your customer volume.
          </p>

          {/* Toggle Monthly / Annual */}
          <div className="pt-2 flex justify-center">
            <div className="bg-[#111111] border border-[#222222] p-1 rounded-xl flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  billingCycle === "monthly" ? "bg-[#D4AF37] text-black shadow-md" : "text-neutral-400 hover:text-white"
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  billingCycle === "annual" ? "bg-[#D4AF37] text-black shadow-md" : "text-neutral-400 hover:text-white"
                }`}
              >
                Annual (Save 17%)
              </button>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
          {loadingPlans ? (
            <div className="col-span-full py-12 text-center text-xs text-neutral-400 flex items-center justify-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin text-[#D4AF37]" />
              <span>Loading subscription plans...</span>
            </div>
          ) : (
            plans.map((plan) => {
              const isPro = plan.id === "plan_pro";
              const isTrial = plan.price_monthly_cents === 0;
              const priceDisplay =
                billingCycle === "annual"
                  ? plan.price_annual_display || `$${Math.round((plan.price_annual_cents || 0) / 100)}`
                  : plan.price_monthly_display || `$${Math.round((plan.price_monthly_cents || 0) / 100)}`;

              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-6 border flex flex-col justify-between space-y-6 transition-all relative ${
                    isPro
                      ? "bg-[#111111] border-[#D4AF37] shadow-xl shadow-[#D4AF37]/10"
                      : "bg-[#0A0A0A] border-[#222222] hover:border-[#333333]"
                  }`}
                >
                  {isPro && (
                    <div className="absolute -top-3 right-6 bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-[#050505] text-[10px] font-extrabold px-3 py-0.5 rounded-full uppercase tracking-wider">
                      Most Popular
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-white">{plan.name}</h3>
                      <p className="text-[11px] text-neutral-400 mt-1">
                        {isTrial ? "14-day full platform access trial" : "Standard production tier"}
                      </p>
                    </div>

                    <div>
                      <span className="text-3xl font-extrabold text-white">{priceDisplay}</span>
                      <span className="text-xs text-neutral-400">/{billingCycle === "annual" ? "yr" : "mo"}</span>
                    </div>

                    <ul className="space-y-2.5 text-xs text-neutral-300 border-t border-[#1C1C1C] pt-4">
                      <li className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-[#D4AF37]" />
                        <span>
                          {plan.message_limit === -1
                            ? "Unlimited AI Messages"
                            : `${plan.message_limit.toLocaleString()} Messages/mo`}
                        </span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-[#D4AF37]" />
                        <span>
                          {plan.seat_limit === -1 ? "Unlimited Seats" : `${plan.seat_limit} Agent Seat Licenses`}
                        </span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-[#D4AF37]" />
                        <span>RAG Knowledge Vectors</span>
                      </li>
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCheckout(plan)}
                    disabled={loadingPlanId === plan.id || checkoutMutation.isPending}
                    className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-2 ${
                      isPro
                        ? "bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] hover:brightness-110 shadow-lg shadow-[#D4AF37]/20"
                        : "bg-[#1C1C1C] hover:bg-[#252525] text-neutral-200 border border-[#2B2B2B]"
                    } disabled:opacity-60`}
                  >
                    {loadingPlanId === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{isTrial ? "Start Free Trial" : `Choose ${plan.name}`}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-4 flex justify-start">
          <button
            type="button"
            onClick={() => router.push("/onboarding/business")}
            className="px-4 py-2 rounded-xl bg-[#141414] border border-[#222222] text-xs font-semibold text-neutral-400 hover:text-white transition-all flex items-center space-x-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Business Info</span>
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center text-xs text-neutral-500 py-4 border-t border-[#1F1F1F]">
        SupportAI Enterprise SaaS Platform &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

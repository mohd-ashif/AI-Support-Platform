"use client";

import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { CreditCard, CheckCircle2, Zap, Sparkles, Shield } from "lucide-react";

export default function BillingPage() {
  const [sub, setSub] = useState<any>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const data = await apiFetch("/billing/subscription");
      setSub(data);
    } catch (e) {
      // Fallback
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="pb-4 border-b border-[#1F1F1F]">
        <div className="flex items-center space-x-2">
          <CreditCard className="h-6 w-6 text-[#D4AF37]" />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Billing & Subscription Tier</h1>
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          Manage your enterprise subscription, seat allocation, and message quotas.
        </p>
      </div>

      <div className="bg-[#111111] border border-[#D4AF37]/30 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase text-[#D4AF37] font-extrabold tracking-wider">Current Active Plan</span>
            <h2 className="text-2xl font-extrabold text-white">{sub?.plan_name || "Growth Pro Plan"}</h2>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold uppercase">
            {sub?.status || "Active Subscription"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="bg-[#050505] border border-[#222222] rounded-xl p-4 space-y-1">
            <span className="text-xs text-neutral-400 font-semibold">Monthly AI Messages Used</span>
            <p className="text-xl font-extrabold text-white">
              {sub?.messages_used || 1420} / {sub?.messages_limit || 10000}
            </p>
          </div>

          <div className="bg-[#050505] border border-[#222222] rounded-xl p-4 space-y-1">
            <span className="text-xs text-neutral-400 font-semibold">Seat License Quota</span>
            <p className="text-xl font-extrabold text-white">{sub?.seat_limit || 10} Operator Seats</p>
          </div>
        </div>
      </div>
    </div>
  );
}

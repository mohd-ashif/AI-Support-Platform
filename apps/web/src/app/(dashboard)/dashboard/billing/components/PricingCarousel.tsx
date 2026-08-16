"use client";

import React, { useState } from "react";
import { formatCurrency, formatNumber } from "@/lib/utils/format";
import { ChevronLeft, ChevronRight, Check, Loader2, Sparkles } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price_monthly_cents: number;
  price_annual_cents: number;
  message_limit: number;
  seat_limit: number;
  features_json?: Record<string, any>;
}

interface PricingCarouselProps {
  plans: Plan[];
  currentPlanId?: string;
  currentPlanName?: string;
  billingCycle: "monthly" | "annual";
  isPending: boolean;
  onSelectPlan: (planId: string) => void;
}

export const PricingCarousel: React.FC<PricingCarouselProps> = ({
  plans,
  currentPlanId,
  currentPlanName,
  billingCycle,
  isPending,
  onSelectPlan,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const total = plans.length;

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? total - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === total - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-6">
      {/* Navigation Header Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-neutral-400 font-semibold">
            Viewing Plan <strong className="text-[#D4AF37]">{currentIndex + 1}</strong> of {total}
          </span>
          <span className="h-1 w-1 rounded-full bg-neutral-600" />
          <span className="text-xs text-neutral-200 font-bold">
            {plans[currentIndex]?.name}
          </span>
        </div>

        {/* Carousel Arrow Buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePrev}
            className="p-2.5 rounded-xl bg-[#141414] border border-[#222222] text-neutral-300 hover:text-white hover:border-[#D4AF37]/50 active:scale-95 transition-all shadow-md flex items-center space-x-1"
            title="Previous Plan"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-xs font-semibold hidden sm:inline">Prev</span>
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="p-2.5 rounded-xl bg-[#141414] border border-[#222222] text-neutral-300 hover:text-white hover:border-[#D4AF37]/50 active:scale-95 transition-all shadow-md flex items-center space-x-1"
            title="Next Plan"
          >
            <span className="text-xs font-semibold hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Carousel Track Container */}
      <div className="relative overflow-hidden rounded-2xl p-1">
        <div
          className="flex transition-transform duration-500 ease-out gap-6"
          style={{
            transform: `translateX(-${currentIndex * (100 / Math.min(total, 3.2))}%)`,
          }}
        >
          {plans.map((p, idx) => {
            const isCurrent = currentPlanId === p.id || currentPlanName === p.name;
            const priceCents = billingCycle === "annual" ? p.price_annual_cents / 12 : p.price_monthly_cents;
            const formattedPrice = formatCurrency(priceCents, true);
            const isFocused = idx === currentIndex;

            return (
              <div
                key={p.id}
                onClick={() => setCurrentIndex(idx)}
                className={`w-[85vw] sm:w-[340px] md:w-[360px] shrink-0 bg-[#111111] border rounded-2xl p-6 flex flex-col justify-between space-y-6 transition-all duration-300 relative cursor-pointer ${
                  isFocused
                    ? "border-[#D4AF37] shadow-2xl shadow-[#D4AF37]/15 ring-2 ring-[#D4AF37]/30 scale-[1.01]"
                    : isCurrent
                    ? "border-[#D4AF37]/60"
                    : "border-[#222222] opacity-85 hover:opacity-100 hover:border-[#D4AF37]/40"
                }`}
              >
                {p.name === "Pro" && (
                  <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-gradient-to-r from-[#D4AF37] to-[#F4D03F] text-black font-extrabold text-[10px] uppercase tracking-wider shadow-lg flex items-center space-x-1">
                    <Sparkles className="h-3 w-3" />
                    <span>Most Popular</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-1">
                    <h4 className="text-lg font-extrabold text-white flex items-center space-x-2">
                      <span>{p.name}</span>
                      {isCurrent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] font-semibold">
                          Active
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-neutral-400 leading-relaxed min-h-[32px]">
                      {p.name === "Free Trial"
                        ? "Test core AI capabilities for 14 days"
                        : p.name === "Starter"
                        ? "Ideal for small support teams & startups"
                        : p.name === "Pro"
                        ? "For growing brands with active customer traffic"
                        : "Enterprise-grade limits and dedicated support"}
                    </p>
                  </div>

                  <div className="flex items-baseline space-x-1">
                    <span className="text-3xl font-black text-white">{formattedPrice}</span>
                    <span className="text-xs text-neutral-400">/ month</span>
                  </div>

                  <div className="space-y-2.5 pt-4 border-t border-[#1C1C1C] text-xs">
                    <div className="flex items-center space-x-2 text-neutral-300">
                      <Check className="h-4 w-4 text-[#D4AF37] shrink-0" />
                      <span>
                        {p.message_limit === -1 ? "Unlimited" : formatNumber(p.message_limit)} Monthly Messages
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-neutral-300">
                      <Check className="h-4 w-4 text-[#D4AF37] shrink-0" />
                      <span>
                        {p.seat_limit === -1 ? "Unlimited" : p.seat_limit} Operator Seats
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-neutral-300">
                      <Check className="h-4 w-4 text-[#D4AF37] shrink-0" />
                      <span>
                        {p.features_json?.sources_limit === -1
                          ? "Unlimited Knowledge Sources"
                          : `${p.features_json?.sources_limit || 2} Knowledge Base Sources`}
                      </span>
                    </div>

                    {p.features_json?.analytics && (
                      <div className="flex items-center space-x-2 text-neutral-300">
                        <Check className="h-4 w-4 text-[#D4AF37] shrink-0" />
                        <span>Advanced Resolution Analytics</span>
                      </div>
                    )}

                    {p.features_json?.api_access && (
                      <div className="flex items-center space-x-2 text-neutral-300">
                        <Check className="h-4 w-4 text-[#D4AF37] shrink-0" />
                        <span>REST API & Webhook Dispatch</span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isCurrent || isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPlan(p.id);
                  }}
                  className={`w-full py-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center space-x-2 ${
                    isCurrent
                      ? "bg-[#1C1C1C] text-neutral-500 cursor-default border border-[#262626]"
                      : "bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-black hover:brightness-110 shadow-lg shadow-[#D4AF37]/10 active:scale-95"
                  }`}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-black" />
                  ) : isCurrent ? (
                    <span>Current Active Plan</span>
                  ) : (
                    <span>Select {p.name}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pagination Dots Controls */}
      <div className="flex items-center justify-center space-x-2 pt-2">
        {plans.map((p, idx) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setCurrentIndex(idx)}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              idx === currentIndex
                ? "w-8 bg-[#D4AF37] shadow-[0_0_10px_#D4AF37]"
                : "w-2.5 bg-[#262626] hover:bg-[#444444]"
            }`}
            title={`Slide to ${p.name}`}
          />
        ))}
      </div>
    </div>
  );
};

"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { setWorkspaces, setSelectedWorkspace } from "@/store/slices/authSlice";
import { useWorkspaces } from "@/hooks/queries/useWorkspaceQueries";
import { billingService } from "@/services/billingService";
import { useToast } from "@/components/ui/ToastProvider";
import { apiFetch } from "@/lib/api";
import { Bot, Loader2, CheckCircle2, RefreshCw, AlertTriangle } from "lucide-react";

function SuccessContent() {
  const router = useRouter();
  const dispatch = useDispatch();
  const toast = useToast();
  const searchParams = useSearchParams();
  const { selectedWorkspace } = useSelector((state: RootState) => state.auth);

  const { refetch: refetchWorkspaces } = useWorkspaces(false);

  const sessionId = searchParams.get("session_id");
  const workspaceId = searchParams.get("workspace_id") || selectedWorkspace?.id || "";

  const [status, setStatus] = useState<"polling" | "confirmed" | "timeout">("polling");
  const [attempts, setAttempts] = useState(0);
  const [isMockCheckout, setIsMockCheckout] = useState(false);

  useEffect(() => {
    let interval: any = null;
    let pollCount = 0;

    if (sessionId?.startsWith("cs_mock_")) {
      setIsMockCheckout(true);
    }

    async function pollStatus() {
      if (!sessionId) {
        setStatus("confirmed");
        setTimeout(() => router.push("/dashboard"), 1200);
        return;
      }

      try {
        pollCount += 1;
        setAttempts(pollCount);

        const res = await billingService.getCheckoutStatus(sessionId, workspaceId);

        if (res?.is_mock) {
          setIsMockCheckout(true);
        }

        if (res?.status === "active") {
          setStatus("confirmed");
          if (interval) clearInterval(interval);

          try {
            const { data: freshWorkspaces } = await refetchWorkspaces();
            if (freshWorkspaces) {
              dispatch(setWorkspaces(freshWorkspaces));
              if (workspaceId) {
                const activeWs = freshWorkspaces.find((w: any) => w.id === workspaceId);
                if (activeWs) {
                  dispatch(setSelectedWorkspace(activeWs));
                }
              }
            }
          } catch (e) {}

          toast.success("Subscription payment confirmed!");
          setTimeout(() => {
            router.push("/dashboard");
          }, 1200);
          return;
        }
      } catch (e) {}

      if (pollCount >= 10) {
        setStatus("timeout");
        if (interval) clearInterval(interval);
      }
    }

    pollStatus();
    interval = setInterval(pollStatus, 1500);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionId, workspaceId, router, dispatch, refetchWorkspaces, toast]);

  const handleManualCheck = async () => {
    setStatus("polling");
    setAttempts(0);
    try {
      const res = await billingService.getCheckoutStatus(sessionId || "", workspaceId);
      if (res?.status === "active") {
        setStatus("confirmed");
        const { data: freshWorkspaces } = await refetchWorkspaces();
        if (freshWorkspaces) {
          dispatch(setWorkspaces(freshWorkspaces));
        }
        toast.success("Payment verified!");
        setTimeout(() => router.push("/dashboard"), 1200);
      } else {
        setTimeout(() => setStatus("timeout"), 2000);
      }
    } catch (e) {
      setStatus("timeout");
    }
  };

  return (
    <div className="w-full max-w-md bg-[#111111] border border-[#222222] rounded-2xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
      {isMockCheckout && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-semibold py-1.5 px-3 rounded-full inline-flex items-center space-x-1.5 mb-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>Local Development Mock Payment Verified</span>
        </div>
      )}

      {status === "polling" && (
        <div className="space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 text-[#D4AF37] animate-spin" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-white">Verifying Stripe Subscription...</h2>
            <p className="text-xs text-neutral-400">
              Confirming payment webhook receipt (Attempt {attempts}/10)
            </p>
          </div>
        </div>
      )}

      {status === "confirmed" && (
        <div className="space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-white">Payment Confirmed!</h2>
            <p className="text-xs text-neutral-400">Redirecting to your SupportAI workspace dashboard...</p>
          </div>
        </div>
      )}

      {status === "timeout" && (
        <div className="space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-white">Confirmation Pending</h2>
            <p className="text-xs text-neutral-400">
              Your subscription is being activated by Stripe webhooks. You can proceed directly to your dashboard.
            </p>
          </div>
          <div className="pt-2 flex flex-col space-y-2">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] font-bold text-xs hover:brightness-110 shadow-lg"
            >
              Go to Dashboard Now
            </button>
            <button
              type="button"
              onClick={handleManualCheck}
              className="w-full py-2.5 rounded-xl bg-[#1A1A1A] border border-[#2B2B2B] text-neutral-300 font-semibold text-xs hover:text-white flex items-center justify-center space-x-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Check Payment Again</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4">
      <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />}>
        <SuccessContent />
      </Suspense>
    </div>
  );
}

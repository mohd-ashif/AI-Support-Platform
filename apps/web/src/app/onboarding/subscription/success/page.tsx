"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store";
import { setWorkspaces, setSelectedWorkspace } from "@/store/slices/authSlice";
import { apiFetch } from "@/lib/api";
import { Bot, Loader2, CheckCircle2, Clock, RefreshCw, AlertTriangle } from "lucide-react";

function SuccessContent() {
  const router = useRouter();
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
  const { selectedWorkspace } = useSelector((state: RootState) => state.auth);

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

        const url = `/billing/checkout-status?session_id=${encodeURIComponent(sessionId)}&workspace_id=${encodeURIComponent(workspaceId)}`;
        const res = await apiFetch(url);

        if (res?.is_mock) {
          setIsMockCheckout(true);
        }

        if (res?.status === "active") {
          setStatus("confirmed");
          if (interval) clearInterval(interval);

          try {
            const freshWorkspaces = await apiFetch("/workspaces");
            dispatch(setWorkspaces(freshWorkspaces));
            if (workspaceId) {
              const activeWs = freshWorkspaces.find((w: any) => w.id === workspaceId);
              if (activeWs) {
                dispatch(setSelectedWorkspace(activeWs));
              }
            }
          } catch (e) {}

          setTimeout(() => {
            router.push("/dashboard");
          }, 1200);
          return;
        }
      } catch (e) {
        // Continue polling until max attempts
      }

      // Timeout fallback after 10 attempts (~15 seconds)
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
  }, [sessionId, workspaceId, router, dispatch]);

  const handleManualCheck = async () => {
    setStatus("polling");
    setAttempts(0);
    try {
      const url = `/billing/checkout-status?session_id=${encodeURIComponent(sessionId || "")}&workspace_id=${encodeURIComponent(workspaceId)}`;
      const res = await apiFetch(url);
      if (res?.status === "active") {
        setStatus("confirmed");
        const freshWorkspaces = await apiFetch("/workspaces");
        dispatch(setWorkspaces(freshWorkspaces));
        setTimeout(() => router.push("/dashboard"), 1200);
      } else {
        setTimeout(() => setStatus("timeout"), 2000);
      }
    } catch (e) {
      setStatus("timeout");
    }
  };

  return (
    <div className="w-full max-w-md bg-[#111111] border border-[#222222] rounded-2xl p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
      {/* Dev Mode Banner */}
      {isMockCheckout && (
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-extrabold uppercase">
          <AlertTriangle className="h-3 w-3" />
          <span>Dev Mode: Simulated Payment</span>
        </div>
      )}

      <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] flex items-center justify-center shadow-xl shadow-[#D4AF37]/20">
        <Bot className="h-6 w-6 text-[#050505]" />
      </div>

      {status === "polling" && (
        <div className="space-y-3">
          <Loader2 className="h-7 w-7 animate-spin text-[#D4AF37] mx-auto" />
          <h2 className="text-lg font-extrabold text-white">Confirming Your Subscription...</h2>
          <p className="text-xs text-neutral-400">
            Verifying payment status ({attempts}/10)
          </p>
        </div>
      )}

      {status === "confirmed" && (
        <div className="space-y-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
          <h2 className="text-xl font-extrabold text-white">Subscription Active!</h2>
          <p className="text-xs text-neutral-300">
            Your workspace session is fully provisioned. Redirecting to your AI dashboard...
          </p>
        </div>
      )}

      {status === "timeout" && (
        <div className="space-y-4">
          <Clock className="h-10 w-10 text-amber-400 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-white">Verification Taking Longer Than Expected</h2>
            <p className="text-xs text-neutral-400">
              Payment verification is taking a moment to finish. Your subscription selection is stored.
            </p>
          </div>

          <div className="pt-2 space-y-2">
            <button
              type="button"
              onClick={handleManualCheck}
              className="w-full py-2.5 rounded-xl bg-[#D4AF37] text-black font-extrabold text-xs hover:brightness-110 transition-all flex items-center justify-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Check Status Again</span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full py-2.5 rounded-xl bg-[#1A1A1A] border border-[#2B2B2B] text-neutral-300 hover:text-white font-bold text-xs transition-all"
            >
              Proceed to Dashboard Anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
      <Suspense fallback={
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37] mx-auto" />
          <p className="text-xs text-neutral-400">Loading Checkout Status...</p>
        </div>
      }>
        <SuccessContent />
      </Suspense>
    </div>
  );
}

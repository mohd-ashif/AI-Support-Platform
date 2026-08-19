"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { setAuth, setAuthStatus } from "@/store/slices/authSlice";
import { authService } from "@/services/authService";
import { setMemoryAccessToken } from "@/lib/api";
import { workspaceService } from "@/services/workspaceService";
import { useToast } from "@/components/ui/ToastProvider";
import { Loader2, Bot } from "lucide-react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function bootstrapOAuthSession() {
      try {
        const errorFromUrl = searchParams.get("error");
        if (errorFromUrl) {
          setError(errorFromUrl);
          toast.error(errorFromUrl);
          dispatch(setAuthStatus("unauthenticated"));
          setTimeout(() => router.push("/login"), 3500);
          return;
        }

        const tokenFromUrl = searchParams.get("token");

        if (tokenFromUrl) {
          setMemoryAccessToken(tokenFromUrl);
          const userRes = await authService.getCurrentUser();
          const workspacesRes = await workspaceService.getWorkspaces().catch(() => []);

          dispatch(
            setAuth({
              user: userRes,
              accessToken: tokenFromUrl,
              workspaces: workspacesRes || [],
            })
          );

          toast.success("Signed in successfully!");

          if (workspacesRes && workspacesRes.length > 0) {
            router.push("/dashboard");
          } else {
            router.push("/onboarding");
          }
        } else {
          setError("Google sign-in did not return a valid session token. Please try again.");
          dispatch(setAuthStatus("unauthenticated"));
          setTimeout(() => router.push("/login"), 3000);
        }
      } catch (err: any) {
        const msg = err.message || "Failed to complete Google sign in.";
        setError(msg);
        toast.error(msg);
        dispatch(setAuthStatus("unauthenticated"));
        setTimeout(() => router.push("/login"), 3000);
      }
    }

    bootstrapOAuthSession();
  }, [dispatch, router, searchParams, toast]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-[#111111] border border-[#222222] rounded-2xl p-8 text-center space-y-6 shadow-2xl">
        <div className="mx-auto h-12 w-12 rounded-xl bg-gradient-to-tr from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20">
          <Bot className="h-7 w-7 text-[#050505]" />
        </div>

        {error ? (
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-red-400">Authentication Failed</h3>
            <p className="text-xs text-neutral-400">{error}</p>
            <p className="text-[10px] text-neutral-500">Redirecting to login...</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37] mx-auto" />
            <h3 className="text-base font-bold text-white">Completing Secure Sign In...</h3>
            <p className="text-xs text-neutral-400">Establishing your encrypted workspace session</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}

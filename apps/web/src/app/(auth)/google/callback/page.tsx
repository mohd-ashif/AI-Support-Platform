"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { setAuth } from "@/store/slices/authSlice";
import { authService } from "@/services/authService";
import { setMemoryAccessToken } from "@/lib/api";
import { useToast } from "@/components/ui/ToastProvider";
import { Loader2, AlertCircle } from "lucide-react";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(errorParam);
      toast.error(errorParam);
      setTimeout(() => router.push("/login"), 3000);
      return;
    }

    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code provided by Google.");
      setTimeout(() => router.push("/login"), 2500);
      return;
    }

    async function processGoogleAuth() {
      try {
        const response = await authService.googleAuth(code!);
        if (response.access_token) {
          setMemoryAccessToken(response.access_token);
        }

        dispatch(
          setAuth({
            user: response.user,
            accessToken: response.access_token,
            workspaces: response.workspaces,
          })
        );

        toast.success("Google Authentication successful!");

        if (response.workspaces && response.workspaces.length > 0) {
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      } catch (err: any) {
        const msg = err.message || "Failed to complete Google authentication.";
        setError(msg);
        toast.error(msg);
        setTimeout(() => router.push("/login"), 3000);
      }
    }

    processGoogleAuth();
  }, [searchParams, dispatch, router, toast]);

  return (
    <div className="w-full space-y-4 text-center py-8 animate-in fade-in duration-300">
      {error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start space-x-3 text-left">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
          <h3 className="text-lg font-semibold text-white">Completing Google Sign In...</h3>
          <p className="text-xs text-neutral-400">Please wait while we set up your secure session.</p>
        </div>
      )}
    </div>
  );
}

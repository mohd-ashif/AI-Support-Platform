"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { setAuth } from "@/store/slices/authSlice";
import { apiFetch } from "@/lib/api";
import { Loader2, AlertCircle } from "lucide-react";

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useDispatch();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("No authorization code provided by Google.");
      return;
    }

    async function processGoogleAuth() {
      try {
        const response = await apiFetch("/auth/google", {
          method: "POST",
          body: JSON.stringify({ code }),
        });

        dispatch(
          setAuth({
            user: response.user,
            accessToken: response.access_token,
            workspaces: response.workspaces,
          })
        );

        if (response.workspaces && response.workspaces.length > 0) {
          router.push("/dashboard");
        } else {
          router.push("/onboarding");
        }
      } catch (err: any) {
        setError(err.message || "Failed to complete Google authentication.");
      }
    }

    processGoogleAuth();
  }, [searchParams, dispatch, router]);

  return (
    <div className="w-full space-y-4 text-center py-8">
      {error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start space-x-3 text-left">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <h3 className="text-lg font-semibold text-white">Completing Google Sign In...</h3>
          <p className="text-xs text-slate-400">Please wait while we set up your secure session.</p>
        </div>
      )}
    </div>
  );
}

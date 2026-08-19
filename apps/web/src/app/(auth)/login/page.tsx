"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import * as z from "zod";
import { useDispatch } from "react-redux";
import { setAuth } from "@/store/slices/authSlice";
import { useLoginMutation } from "@/hooks/queries/useAuthQueries";
import { authService } from "@/services/authService";
import { useToast } from "@/components/ui/ToastProvider";
import { apiFetch } from "@/lib/api";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const toast = useToast();
  const loginMutation = useLoginMutation();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setErrorMessage(null);
    try {
      const response = await loginMutation.mutateAsync(data);

      dispatch(
        setAuth({
          user: response.user,
          accessToken: response.access_token,
          workspaces: response.workspaces,
        })
      );

      toast.success("Successfully logged in!");

      const redirectUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect") : null;
      if (redirectUrl) {
        router.push(redirectUrl);
      } else {
        const primaryWs = (response.workspaces && response.workspaces.length > 0) ? response.workspaces[0] : null;
        if (primaryWs && (primaryWs.status === "active" || primaryWs.status === "trialing" || primaryWs.role === "agent" || primaryWs.role === "admin")) {
          router.push("/dashboard");
        } else if (primaryWs && primaryWs.status === "onboarding") {
          router.push("/onboarding/subscription");
        } else {
          router.push("/onboarding/business");
        }
      }
    } catch (err: any) {
      const msg = err.message || "Failed to log in. Please check your credentials.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    try {
      const res = await authService.getGoogleUrl();
      if (res?.url) {
        window.location.href = res.url;
      } else {
        const demoRes = await authService.googleAuth("demo_code_123");
        dispatch(
          setAuth({
            user: demoRes.user,
            accessToken: demoRes.access_token,
            workspaces: demoRes.workspaces,
          })
        );
        toast.success("Google login successful!");
        router.push(demoRes.workspaces?.length ? "/dashboard" : "/onboarding");
      }
    } catch (err: any) {
      const msg = err.message || "Failed to initialize Google login.";
      setErrorMessage(msg);
      toast.error(msg);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="space-y-2 text-center lg:text-left">
        <h2 className="text-3xl font-extrabold text-white tracking-tight">
          Welcome back to <span className="text-[#D4AF37]">SupportAI</span>
        </h2>
        <p className="text-sm text-neutral-400">
          Enter your credentials to access your enterprise dashboard
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Social Google Login Button */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading || loginMutation.isPending}
        className="w-full flex items-center justify-center space-x-3 px-4 py-3 rounded-xl bg-[#111111] border border-[#222222] hover:border-[#D4AF37]/50 hover:bg-[#181818] text-white text-sm font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 disabled:opacity-60"
      >
        {googleLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>Continue with Google</span>
      </button>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="border-t border-[#222222] w-full" />
        <span className="bg-[#050505] px-3 text-xs text-neutral-500 uppercase font-medium tracking-wider">Or continue with email</span>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Work Email</label>
          <input
            type="email"
            placeholder="name@company.com"
            {...register("email")}
            className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-[#222222] text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
          )}
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-xs font-semibold text-neutral-300">Password</label>
            <a href="#" className="text-xs text-[#D4AF37] hover:text-[#F4D03F] transition-colors">
              Forgot password?
            </a>
          </div>
          <input
            type="password"
            placeholder="••••••••"
            {...register("password")}
            className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-[#222222] text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] hover:brightness-110 text-[#050505] font-bold text-sm shadow-lg shadow-[#D4AF37]/20 transition-all focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 disabled:opacity-60"
        >
          {loginMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#050505]" />
          ) : (
            <>
              <span>Sign In to Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Footer Signup Link */}
      <p className="text-center text-xs text-neutral-400">
        Don&apos;t have an account yet?{" "}
        <Link href="/signup" className="text-[#D4AF37] hover:text-[#F4D03F] font-semibold transition-colors">
          Sign up
        </Link>
      </p>
    </div>
  );
}

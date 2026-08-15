"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import * as z from "zod";
import { useDispatch } from "react-redux";
import { setAuth } from "@/store/slices/authSlice";
import { useSignupMutation } from "@/hooks/queries/useAuthQueries";
import { authService } from "@/services/authService";
import { useToast } from "@/components/ui/ToastProvider";
import { apiFetch } from "@/lib/api";
import { Loader2, AlertCircle, ArrowRight } from "lucide-react";

const signupSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid work email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const toast = useToast();
  const signupMutation = useSignupMutation();

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  const passwordValue = watch("password", "");

  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const passwordStrength = getPasswordStrength(passwordValue);

  const onSubmit = async (data: SignupFormValues) => {
    setErrorMessage(null);
    try {
      const response = await signupMutation.mutateAsync(data);

      dispatch(
        setAuth({
          user: response.user,
          accessToken: response.access_token,
          workspaces: response.workspaces,
        })
      );

      toast.success("Account created successfully!");

      const redirectUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect") : null;
      if (redirectUrl) {
        router.push(redirectUrl);
      } else if (response.workspaces && response.workspaces.length > 0) {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    } catch (err: any) {
      const msg = err.message || "Failed to create account. Please try again.";
      setErrorMessage(msg);
      toast.error(msg);
    }
  };

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setErrorMessage(null);
    try {
      const res = await authService.getGoogleUrl();
      if (res?.url) {
        window.location.href = res.url;
      } else {
        const demoRes = await authService.googleAuth("demo_signup_code");
        dispatch(
          setAuth({
            user: demoRes.user,
            accessToken: demoRes.access_token,
            workspaces: demoRes.workspaces,
          })
        );
        toast.success("Google signup successful!");
        router.push(demoRes.workspaces?.length ? "/dashboard" : "/onboarding");
      }
    } catch (err: any) {
      const msg = err.message || "Failed to initialize Google sign up.";
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
          Create a <span className="text-[#D4AF37]">SupportAI</span> account
        </h2>
        <p className="text-sm text-neutral-400">
          Start deploying intelligent AI support agents in minutes
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start space-x-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Social Google Signup */}
      <button
        type="button"
        onClick={handleGoogleSignup}
        disabled={googleLoading || signupMutation.isPending}
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
        <span>Sign up with Google</span>
      </button>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <div className="border-t border-[#222222] w-full" />
        <span className="bg-[#050505] px-3 text-xs text-neutral-500 uppercase font-medium tracking-wider">Or register with email</span>
      </div>

      {/* Signup Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Full Name</label>
          <input
            type="text"
            placeholder="Jane Doe"
            {...register("name")}
            className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-[#222222] text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
          />
          {errors.name && (
            <p className="mt-1 text-xs text-red-400">{errors.name.message}</p>
          )}
        </div>

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
          <label className="block text-xs font-semibold text-neutral-300 mb-1.5">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            {...register("password")}
            className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-[#222222] text-white placeholder-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/50 focus:border-[#D4AF37] transition-all"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
          )}

          {/* Password strength bar */}
          {passwordValue.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="flex space-x-1 h-1.5 w-full bg-[#111111] rounded-full overflow-hidden border border-[#222222]">
                <div
                  className={`h-full transition-all duration-300 ${
                    passwordStrength <= 1
                      ? "w-1/4 bg-red-500"
                      : passwordStrength === 2
                      ? "w-2/4 bg-amber-500"
                      : passwordStrength === 3
                      ? "w-3/4 bg-[#F4D03F]"
                      : "w-full bg-[#D4AF37]"
                  }`}
                />
              </div>
              <span className="text-[10px] text-neutral-400">
                {passwordStrength <= 1
                  ? "Weak password"
                  : passwordStrength === 2
                  ? "Fair password"
                  : passwordStrength === 3
                  ? "Good password"
                  : "Strong password"}
              </span>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={signupMutation.isPending}
          className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] hover:brightness-110 text-[#050505] font-bold text-sm shadow-lg shadow-[#D4AF37]/20 transition-all focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 disabled:opacity-60"
        >
          {signupMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#050505]" />
          ) : (
            <>
              <span>Create Free Account</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      {/* Footer Login Link */}
      <p className="text-center text-xs text-neutral-400">
        Already have an account?{" "}
        <Link href="/login" className="text-[#D4AF37] hover:text-[#F4D03F] font-semibold transition-colors">
          Log in
        </Link>
      </p>
    </div>
  );
}

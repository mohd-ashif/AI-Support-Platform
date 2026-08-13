"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getMemoryAccessToken, setMemoryWorkspaceId } from "@/lib/api";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { setAuth, setSelectedWorkspace } from "@/store/slices/authSlice";
import { Shield, CheckCircle2, AlertCircle, Loader2, ArrowRight, Building2, UserCheck } from "lucide-react";

interface InvitePageProps {
  params: { token: string };
}

export default function InviteAcceptancePage({ params }: InvitePageProps) {
  const inviteToken = params?.token;
  const router = useRouter();
  const dispatch = useDispatch();

  const { isAuthenticated, accessToken: reduxToken } = useSelector((state: RootState) => state.auth);
  const token = reduxToken || getMemoryAccessToken();

  const [details, setDetails] = useState<{
    email: string;
    workspace_name: string;
    role: string;
    valid: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    fetchInviteDetails();
  }, [inviteToken]);

  const fetchInviteDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/settings/invites/${inviteToken}`);
      setDetails(res);
      if (!res.valid) {
        setError("This invitation link is invalid or has expired.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load invitation details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (details?.valid && token && !accepting && !success && !error) {
      handleAcceptInvite();
    }
  }, [details, token]);

  const handleAcceptInvite = async () => {
    setAccepting(true);
    setError(null);

    // If user is not logged in, redirect them to login first with return URL
    const userAuthToken = getMemoryAccessToken();
    if (!userAuthToken) {
      router.push(`/login?redirect=/invite/${inviteToken}`);
      return;
    }

    try {
      const res = await apiFetch(`/settings/invites/${inviteToken}/accept`, {
        method: "POST",
      });
      setSuccess(true);

      const userRes = await apiFetch("/auth/me").catch(() => null);
      const workspacesRes = await apiFetch("/workspaces").catch(() => []);
      const currentToken = getMemoryAccessToken();
      if (userRes && currentToken) {
        dispatch(
          setAuth({
            user: userRes,
            accessToken: currentToken,
            workspaces: workspacesRes || [],
          })
        );
        if (res?.workspace_id && Array.isArray(workspacesRes)) {
          const joinedWs = workspacesRes.find(
            (w: any) => (w.id || w.workspace_id) === res.workspace_id
          );
          if (joinedWs) {
            dispatch(setSelectedWorkspace(joinedWs));
            setMemoryWorkspaceId(joinedWs.id || joinedWs.workspace_id);
          }
        }
      }

      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes("401") || err.message?.includes("token")) {
        router.push(`/login?redirect=/invite/${inviteToken}`);
      } else {
        setError(err.message || "Failed to accept invitation. Make sure you are logged into the matching account.");
      }
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-[#111111] border border-[#222222] rounded-3xl p-8 space-y-6 shadow-2xl animate-in zoom-in-95">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#D4AF37] to-[#F4D03F] text-[#050505] font-extrabold text-xl flex items-center justify-center mx-auto shadow-lg">
            S
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">SupportAI Platform</h1>
          <p className="text-xs text-neutral-400">Team Workspace Invitation</p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-neutral-400 space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37] mx-auto" />
            <p>Validating invitation token...</p>
          </div>
        ) : details?.status === "accepted" ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-4 text-emerald-400">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <div>
              <h3 className="font-extrabold text-base text-white">Invitation Already Accepted</h3>
              <p className="text-xs text-neutral-400 mt-1">
                You are an active <span className="text-emerald-400 font-bold uppercase">{details.role}</span> in{" "}
                <strong className="text-white">{details.workspace_name}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] text-xs font-extrabold hover:brightness-110 transition-all shadow-lg flex items-center justify-center space-x-2"
            >
              <span>Go to Workspace Dashboard</span>
              <ArrowRight className="h-4 w-4 text-[#050505]" />
            </button>
          </div>
        ) : error && !details?.valid ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-center space-y-4 text-xs text-red-400">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
            <p className="font-semibold">{error}</p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="px-4 py-2 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] text-neutral-200 font-bold transition-all"
            >
              Back to Login
            </button>
          </div>
        ) : success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-4 text-emerald-400">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto animate-bounce" />
            <div>
              <h3 className="font-extrabold text-base text-white">Invitation Accepted!</h3>
              <p className="text-xs text-emerald-400/90 mt-1">
                You have successfully joined the team. Redirecting to workspace dashboard...
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#050505] border border-[#222222] rounded-2xl p-5 space-y-4">
              <div className="flex items-center space-x-3 text-neutral-300 text-xs">
                <Building2 className="h-4 w-4 text-[#D4AF37] shrink-0" />
                <div>
                  <span className="text-neutral-500 text-[10px] block">WORKSPACE</span>
                  <span className="font-bold text-white text-sm">{details?.workspace_name || "SupportAI Workspace"}</span>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-neutral-300 text-xs pt-2 border-t border-[#1A1A1A]">
                <UserCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-neutral-500 text-[10px] block">ROLE ASSIGNED</span>
                  <span className="font-extrabold text-emerald-400 uppercase tracking-wider text-xs">
                    {details?.role}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-neutral-300 text-xs pt-2 border-t border-[#1A1A1A]">
                <Shield className="h-4 w-4 text-indigo-400 shrink-0" />
                <div>
                  <span className="text-neutral-500 text-[10px] block">INVITED EMAIL</span>
                  <span className="font-mono text-neutral-200">{details?.email}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {token ? (
              <button
                type="button"
                disabled={accepting}
                onClick={handleAcceptInvite}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] text-xs font-extrabold hover:brightness-110 transition-all shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {accepting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#050505]" />
                    <span>Joining Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Accept Invitation & Join Workspace</span>
                    <ArrowRight className="h-4 w-4 text-[#050505]" />
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => router.push(`/login?redirect=/invite/${inviteToken}`)}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] text-[#050505] text-xs font-extrabold hover:brightness-110 transition-all shadow-lg flex items-center justify-center space-x-2"
                >
                  <span>Log In to Accept Invitation</span>
                  <ArrowRight className="h-4 w-4 text-[#050505]" />
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/signup?redirect=/invite/${inviteToken}`)}
                  className="w-full py-3 rounded-2xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2B2B2B] text-neutral-200 text-xs font-bold transition-all text-center"
                >
                  Create New Account to Join
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

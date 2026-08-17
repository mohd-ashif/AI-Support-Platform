"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { setAuth, logoutUser } from "@/store/slices/authSlice";
import { apiFetch, getMemoryAccessToken, setMemoryAccessToken, clearAllAuthStorage } from "@/lib/api";
import { useCurrentUser } from "@/hooks/queries/useAuthQueries";
import { useWorkspaces } from "@/hooks/queries/useWorkspaceQueries";
import { NeuralNetworkLoader } from "@/components/ui/NeuralNetworkLoader";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const { isAuthenticated, selectedWorkspace, workspaces } = useSelector((state: RootState) => state.auth);

  // Derive active workspace
  const currentWsId = selectedWorkspace?.id || selectedWorkspace?.workspace_id;
  const freshWs = Array.isArray(workspaces) && currentWsId ? workspaces.find((w: any) => (w.id || w.workspace_id) === currentWsId) : null;
  const activeWs = freshWs || selectedWorkspace || (workspaces && workspaces.length > 0 ? workspaces[0] : null);

  const [mounted, setMounted] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (getMemoryAccessToken()) {
      setInitializing(false);
    }
    const fallbackTimer = setTimeout(() => {
      setInitializing(false);
    }, 10000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  useEffect(() => {
    async function checkSession() {
      if (pathname.startsWith("/auth/callback") || pathname.startsWith("/invite")) {
        setInitializing(false);
        return;
      }

      const isExplicitLogout = typeof window !== "undefined" && sessionStorage.getItem("explicit_logout") === "true";
      const token = getMemoryAccessToken();

      // If user explicitly logged out or has no memory token, abort session restoration
      if (isExplicitLogout || !token) {
        setInitializing(false);
        return;
      }

      if (!isAuthenticated && token) {
        try {
          const userRes = await apiFetch("/auth/me");
          const workspacesRes = await apiFetch("/workspaces").catch(() => []);
          if (userRes) {
            dispatch(
              setAuth({
                user: userRes,
                accessToken: token,
                workspaces: workspacesRes || [],
              })
            );
          }
        } catch (e) {
          // Token invalid or session expired
          clearAllAuthStorage();
          dispatch(logoutUser());
        }
      }
      setInitializing(false);
    }

    checkSession();
  }, [dispatch, isAuthenticated, pathname]);

  useEffect(() => {
    if (!mounted || initializing || pathname.startsWith("/auth/callback")) return;

    const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
    const isDashboardRoute = pathname.startsWith("/dashboard");
    const isOnboardingRoute = pathname.startsWith("/onboarding");

    // 1. Unauthenticated users on protected routes -> Instant redirect
    if ((isDashboardRoute || isOnboardingRoute) && !isAuthenticated && !getMemoryAccessToken()) {
      if (typeof window !== "undefined") {
        window.location.replace("/login");
      } else {
        router.replace("/login");
      }
      return;
    }

    if (isAuthenticated) {
      const hasWorkspaces = Array.isArray(workspaces) && workspaces.length > 0;

      // 2. Authenticated users with 0 workspaces
      if (!hasWorkspaces || !activeWs) {
        if (!isOnboardingRoute) {
          router.replace("/onboarding/business");
        }
        return;
      }

      const status = activeWs.status;
      const role = activeWs.role;

      // Non-owner team members (agents, admins) bypass owner onboarding flow
      if (role === "agent" || role === "admin" || status === "active" || status === "trialing" || status === "past_due") {
        if (isAuthRoute || (isOnboardingRoute && role !== "owner")) {
          router.replace("/dashboard");
        }
        return;
      }

      // 4. Owner Onboarding Status Handling
      if (status === "onboarding") {
        if (isDashboardRoute) {
          router.replace("/onboarding/subscription");
        }
      } else if (status === "canceled") {
        if (pathname !== "/onboarding/subscription") {
          router.replace("/onboarding/subscription?canceled=1");
        }
      }
    }
  }, [mounted, initializing, isAuthenticated, activeWs, workspaces, pathname, router]);

  if (initializing) {
    return <NeuralNetworkLoader size="fullscreen" text="" />;
  }

  const isDashboardRoute = pathname.startsWith("/dashboard");
  const isOnboardingRoute = pathname.startsWith("/onboarding");
  if ((isDashboardRoute || isOnboardingRoute) && !isAuthenticated && !getMemoryAccessToken()) {
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
    return <NeuralNetworkLoader size="fullscreen" text="Redirecting to login..." />;
  }

  if (isDashboardRoute && activeWs?.status === "onboarding") {
    return <NeuralNetworkLoader size="fullscreen" text="Redirecting to subscription..." />;
  }

  return <>{children}</>;
}

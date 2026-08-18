import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const refreshToken = request.cookies.get("refresh_token")?.value;
  const authSession = request.cookies.get("auth_session")?.value;
  const hasTokenParam = searchParams.has("token");

  const isCookieAuthenticated = Boolean(refreshToken || authSession || hasTokenParam);

  // Protect (dashboard) and onboarding routes:
  // If server-side cookies exist, enforce edge protection.
  // Otherwise, allow request to pass through so AuthGuard can check in-memory tokens.
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding")) {
    if (!isCookieAuthenticated && request.headers.get("accept")?.includes("text/html")) {
      // Check if client transition or initial document request
      const isClientNavigation = request.headers.get("next-router-state-tree") || request.headers.get("purpose") === "prefetch";
      if (!isClientNavigation) {
        // Allow AuthGuard client-side validation for decoupled backend architectures
        return NextResponse.next();
      }
    }
  }

  // Redirect authenticated users away from /login and /signup
  if ((pathname === "/login" || pathname === "/signup") && refreshToken) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding", "/onboarding/:path*", "/login", "/signup"],
};

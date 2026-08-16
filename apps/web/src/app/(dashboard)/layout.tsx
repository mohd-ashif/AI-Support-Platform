"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store";
import { logoutUser, setSelectedWorkspace } from "@/store/slices/authSlice";
import { useLogoutMutation } from "@/hooks/queries/useAuthQueries";
import { useUIStore } from "@/stores/useUIStore";
import { useToast } from "@/components/ui/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { widgetService } from "@/services/widgetService";
import { teamService } from "@/services/teamService";
import { inboxService } from "@/services/inboxService";
import { analyticsService } from "@/services/analyticsService";
import { useDashboardSocket } from "@/hooks/useDashboardSocket";
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  Sliders,
  BarChart3,
  Users,
  CreditCard,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
  Bell,
  Sparkles,
  ExternalLink,
} from "lucide-react";

import { NotificationPopover } from "@/components/ui/NotificationPopover";

import { usePermissions } from "@/hooks/usePermissions";
import { Permissions } from "@/lib/permissions";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  // Connect real-time WebSocket listener for live dashboard metrics
  useDashboardSocket();

  const user = useSelector((state: RootState) => state.auth.user);
  const workspaces = useSelector((state: RootState) => state.auth.workspaces || []);
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);

  const logoutMutation = useLogoutMutation();

  const activeWs = selectedWorkspace || (workspaces.length > 0 ? workspaces[0] : null);
  const activeWsId = activeWs?.id;

  // Close workspace dropdown on outside click
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("#workspace-switcher-container")) {
        setWorkspaceMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (e) {
      // Ignore network errors on logout
    }
    dispatch(logoutUser());
    toast.info("Logged out of session.");
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  };

  const navItems = [
    { name: "Overview", href: "/dashboard", icon: LayoutDashboard, permission: Permissions.ANALYTICS_READ },
    { name: "Live Inbox", href: "/dashboard/inbox", icon: MessageSquare, permission: Permissions.CONVERSATIONS_READ },
    { name: "Knowledge Base", href: "/dashboard/knowledge", icon: BookOpen, permission: Permissions.KNOWLEDGE_READ },
    { name: "Widget Setup", href: "/dashboard/widget", icon: Sliders, permission: Permissions.WIDGET_READ },
    { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3, permission: Permissions.ANALYTICS_READ },
    { name: "Team Members", href: "/dashboard/team", icon: Users, permission: Permissions.TEAM_READ },
    { name: "Billing & Plans", href: "/dashboard/billing", icon: CreditCard, permission: Permissions.BILLING_READ },
    { name: "Settings", href: "/dashboard/settings", icon: Settings, permission: Permissions.SETTINGS_READ },
  ];

  const visibleNavItems = navItems.filter((item) => can(item.permission));

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      {/* Left Sidebar */}
      <aside className="w-64 bg-[#0A0A0A] border-r border-[#1F1F1F] flex flex-col justify-between p-4 shrink-0 selection:bg-[#D4AF37]/30">
        <div className="space-y-6">
          {/* Brand Logo */}
          <Link
            href="/dashboard"
            className="flex items-center space-x-3 px-2 py-1 group transition-transform duration-200 active:scale-95"
          >
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#D4AF37] via-[#F4D03F] to-[#FFEAA7] flex items-center justify-center shadow-lg shadow-[#D4AF37]/20 group-hover:shadow-[#D4AF37]/40 group-hover:scale-105 transition-all duration-300">
              <Bot className="h-5 w-5 text-[#050505]" />
            </div>
            <span className="font-extrabold text-lg tracking-tight">
              Support<span className="text-[#D4AF37]">AI</span>
            </span>
          </Link>

          {/* Workspace Switcher */}
          <div id="workspace-switcher-container" className="relative">
            <button
              type="button"
              onClick={() => setWorkspaceMenuOpen(!workspaceMenuOpen)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-[#141414] border border-[#222222] hover:border-[#D4AF37]/50 hover:bg-[#181818] active:scale-[0.99] transition-all duration-200 text-left"
            >
              <div className="flex items-center space-x-2.5 truncate">
                <div className="h-7 w-7 rounded-lg bg-[#222222] flex items-center justify-center shrink-0">
                  <Building2 className="h-4 w-4 text-[#D4AF37]" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-neutral-200 truncate">
                    {activeWs?.business?.name || "My Organization"}
                  </p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">
                    {activeWs?.role || "Owner"}
                  </p>
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 text-neutral-400 shrink-0 transition-transform duration-200 ${
                  workspaceMenuOpen ? "rotate-180 text-[#D4AF37]" : ""
                }`}
              />
            </button>

            {/* Switcher Dropdown */}
            {workspaceMenuOpen && (
              <div className="absolute left-0 right-0 mt-2 bg-[#141414] border border-[#262626] rounded-xl shadow-2xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-2 py-1 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                  Workspaces
                </div>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      dispatch(setSelectedWorkspace(ws));
                      setWorkspaceMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                      activeWs?.id === ws.id
                        ? "bg-[#D4AF37]/10 text-[#D4AF37] font-bold"
                        : "hover:bg-[#1A1A1A] text-neutral-300"
                    }`}
                  >
                    <span className="truncate">{ws.business?.name || "Workspace"}</span>
                    {activeWs?.id === ws.id && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_6px_#D4AF37]" />
                    )}
                  </button>
                ))}
                <Link
                  href="/onboarding"
                  onClick={() => setWorkspaceMenuOpen(false)}
                  className="w-full flex items-center space-x-2 px-2.5 py-2 rounded-lg text-xs text-[#D4AF37] hover:bg-[#1A1A1A] transition-colors pt-2 border-t border-[#222222]"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>+ Create Workspace</span>
                </Link>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              const handlePrefetch = () => {
                if (!activeWsId) return;
                if (item.href.includes("widget")) {
                  queryClient.prefetchQuery({ queryKey: queryKeys.widget.config(activeWsId), queryFn: () => widgetService.getConfig(activeWsId) });
                } else if (item.href.includes("team")) {
                  queryClient.prefetchQuery({ queryKey: queryKeys.team.members(activeWsId), queryFn: () => teamService.getMembers(activeWsId) });
                } else if (item.href.includes("inbox")) {
                  queryClient.prefetchQuery({ queryKey: queryKeys.inbox.conversations(activeWsId), queryFn: () => inboxService.getConversations(activeWsId) });
                } else if (item.href.includes("analytics")) {
                  queryClient.prefetchQuery({ queryKey: queryKeys.analytics.summary(activeWsId, "7d"), queryFn: () => analyticsService.getSummary("7d", activeWsId) });
                }
              };

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={true}
                  onMouseEnter={handlePrefetch}
                  className={`group relative flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ease-out active:scale-[0.98] ${
                    isActive
                      ? "bg-gradient-to-r from-[#D4AF37]/20 via-[#D4AF37]/10 to-transparent text-[#D4AF37] border border-[#D4AF37]/40 shadow-lg shadow-[#D4AF37]/5 translate-x-1"
                      : "text-neutral-400 hover:text-white hover:bg-[#141414] hover:translate-x-1"
                  }`}
                >
                  {/* Glowing active left indicator pill */}
                  {isActive && (
                    <span className="absolute -left-1 top-2 bottom-2 w-1 rounded-r-full bg-[#D4AF37] shadow-[0_0_8px_#D4AF37]" />
                  )}
                  <Icon
                    className={`h-4 w-4 transition-transform duration-200 ease-out group-hover:scale-110 ${
                      isActive ? "text-[#D4AF37]" : "text-neutral-500 group-hover:text-neutral-200"
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer Profile */}
        <div className="pt-4 border-t border-[#1F1F1F] space-y-3">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center space-x-2.5 truncate">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#D4AF37] to-[#F4D03F] text-[#050505] font-bold text-xs flex items-center justify-center shrink-0 shadow-md shadow-[#D4AF37]/20">
                {user?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-neutral-200 truncate">{user?.name || "User Account"}</p>
                <p className="text-[10px] text-neutral-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 active:scale-95 transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-[#0A0A0A] border-b border-[#1F1F1F] px-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h1 className="text-sm font-bold text-neutral-200">
              {activeWs?.business?.name ? `${activeWs.business.name} Dashboard` : "Enterprise Dashboard"}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
              Active Session
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <NotificationPopover />
            <Link
              href="/onboarding"
              className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#141414] border border-[#222222] hover:border-[#D4AF37]/40 text-xs font-semibold text-neutral-300 hover:text-white transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span>Configure AI Widget</span>
            </Link>
          </div>
        </header>

        {/* Page View Body */}
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

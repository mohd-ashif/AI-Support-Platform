import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { hasPermission } from "@/lib/permissions";

/**
 * Reusable React Hook to check RBAC permissions for current workspace role.
 */
export function usePermissions() {
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const userRole = selectedWorkspace?.role || "owner";

  const can = (permission: string): boolean => {
    return hasPermission(userRole, permission);
  };

  return {
    role: userRole,
    can,
    isOwner: userRole.toLowerCase() === "owner",
    isAdmin: userRole.toLowerCase() === "admin",
    isManager: userRole.toLowerCase() === "manager",
    isAgent: userRole.toLowerCase() === "agent",
    isViewer: userRole.toLowerCase() === "viewer",
  };
}

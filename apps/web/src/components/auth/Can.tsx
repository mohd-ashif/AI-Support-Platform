import React from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface CanProps {
  permission: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Reusable UI Permission Boundary component.
 * Renders `children` if the current workspace role possesses `permission`.
 * Otherwise renders `fallback` (default null).
 */
export function Can({ permission, fallback = null, children }: CanProps) {
  const { can } = usePermissions();

  if (!can(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

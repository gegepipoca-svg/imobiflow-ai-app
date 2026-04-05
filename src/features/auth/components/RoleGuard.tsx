import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { AppRole } from "./AuthProvider";

interface RoleGuardProps {
  allowedRoles: AppRole[];
}

/**
 * Protects routes based on user role.
 * Admin always has access; consultors only see allowed routes.
 */
export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const { profile, loading } = useAuth();

  if (loading) return null;

  const userRole = profile?.role ?? "consultor";

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

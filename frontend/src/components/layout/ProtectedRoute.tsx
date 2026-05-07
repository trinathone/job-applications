import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import client from "../../api/client";

/**
 * Gate for authenticated routes. Redirects to /login if no token.
 * Also refreshes the user profile (/me) on mount so is_admin is always current.
 */
export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());
  const setAuth         = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);
  const location        = useLocation();

  // Refresh user profile (picks up is_admin and any display_name changes)
  useEffect(() => {
    if (!token) return;
    client.get("/auth/me").then((res) => {
      if (token) setAuth(token, { ...res.data, is_admin: res.data.is_admin ?? false });
    }).catch(() => { /* token may be expired — ProtectedRoute will redirect */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

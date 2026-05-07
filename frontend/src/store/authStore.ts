import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthUser {
  id: number;
  email: string;
  display_name: string | null;
  is_admin: boolean;
}

interface AuthStore {
  token: string | null;
  user: AuthUser | null;
  setAuth(token: string, user: AuthUser): void;
  clearAuth(): void;
  isAuthenticated(): boolean;
  isAdmin(): boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user:  null,

      setAuth(token, user) { set({ token, user }); },
      clearAuth()          { set({ token: null, user: null }); },
      isAuthenticated()    { return !!get().token; },
      isAdmin()            { return get().user?.is_admin ?? false; },
    }),
    {
      name: "jam-auth",
      partialize: (s) => ({ token: s.token, user: s.user }),
    }
  )
);

import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

interface ThemeStore {
  theme: Theme;
  toggle: () => void;
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "dark",
      toggle: () => {
        const next: Theme = get().theme === "dark" ? "light" : "dark";
        set({ theme: next });
        applyTheme(next);
      },
    }),
    { name: "ja-theme" },
  ),
);

/** Call once on app startup to restore persisted theme without flash */
export function initTheme() {
  try {
    const raw = localStorage.getItem("ja-theme");
    const theme: Theme = raw
      ? ((JSON.parse(raw) as { state: { theme: Theme } }).state.theme ?? "dark")
      : "dark";
    applyTheme(theme);
  } catch {
    applyTheme("dark");
  }
}

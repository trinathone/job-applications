/**
 * ViewModeContext
 *
 * Tracks whether the user wants "phone" or "desktop" view regardless of
 * their actual device. Stored in localStorage so it survives page reloads.
 *
 * Values:
 *   "auto"    – use the real screen (default)
 *   "phone"   – force phone UI: 390px centered portrait column
 *   "desktop" – force desktop UI: viewport meta width=1280 (scaled down on mobile)
 */

import { createContext, useContext, type ReactNode } from "react";

export type ViewMode = "auto" | "phone" | "desktop";

const KEY = "ja-view";

/* ── Read & derive on boot (before React renders) ──────────────────── */

export function getStoredMode(): ViewMode {
  return (localStorage.getItem(KEY) as ViewMode) ?? "auto";
}

export function isPhysicallyMobile(): boolean {
  return window.innerWidth < 768 || window.matchMedia("(pointer: coarse)").matches;
}

/** True when the app should render the mobile UI (regardless of device) */
export function derivedIsMobile(mode: ViewMode): boolean {
  if (mode === "phone") return true;
  if (mode === "desktop") return false;
  return isPhysicallyMobile();
}

/* ── Apply viewport meta (must run before first paint) ─────────────── */
export function applyViewportMeta(mode: ViewMode) {
  const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
  if (!meta) return;
  if (mode === "desktop") {
    meta.content = "width=1280, initial-scale=0.5, maximum-scale=0.5";
  } else {
    meta.content = "width=device-width, initial-scale=1";
  }
}

/* ── Context ────────────────────────────────────────────────────────── */

interface ViewModeCtx {
  mode: ViewMode;
  isMobile: boolean;
  physicallyMobile: boolean;
  /** Save new mode + reload the page */
  switchTo(next: ViewMode): void;
}

const Ctx = createContext<ViewModeCtx>({
  mode: "auto",
  isMobile: false,
  physicallyMobile: false,
  switchTo: () => {},
});

export function useViewMode() {
  return useContext(Ctx);
}

/* ── Provider ───────────────────────────────────────────────────────── */

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const mode = getStoredMode();
  const physicallyMobile = isPhysicallyMobile();
  const isMobile = derivedIsMobile(mode);

  function switchTo(next: ViewMode) {
    localStorage.setItem(KEY, next);
    window.location.reload();
  }

  return (
    <Ctx.Provider value={{ mode, isMobile, physicallyMobile, switchTo }}>
      {children}
    </Ctx.Provider>
  );
}

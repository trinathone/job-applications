import { useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import SimpleCursor from "./components/ui/SimpleCursor";
import NoiseOverlay from "./components/ui/NoiseOverlay";
import LoadingScreen from "./components/ui/LoadingScreen";
import UndoToast from "./components/ui/UndoToast";
import Shell from "./components/layout/Shell";
import DashboardPage from "./pages/DashboardPage";
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";
import AdminPage from "./pages/AdminPage";
import { useJobStore } from "./store/jobStore";
import { useAuthStore } from "./store/authStore";
import { useSkipJobApi } from "./hooks/useApplications";
import {
  ViewModeProvider,
  useViewMode,
  applyViewportMeta,
  getStoredMode,
} from "./context/ViewModeContext";

// Apply viewport meta immediately on load (before first render)
applyViewportMeta(getStoredMode());

const HAS_LOADED = sessionStorage.getItem("ja-loaded");

/* ── Skip manager ────────────────────────────────────────────────── */
function GlobalSkipManager() {
  const undoSkip              = useJobStore((s) => s.undoSkip);
  const { mutate: commitSkip } = useSkipJobApi();
  const token                 = useAuthStore((s) => s.token);
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null);

  interface SkipState { jobId: number; title: string }
  const [pending, setPending] = useState<SkipState | null>(null);

  useEffect(() => {
    const onSkipped = (e: CustomEvent<{ jobId: number; title: string }>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        if (pending && token) commitSkip({ jobId: pending.jobId });
      }
      setPending({ jobId: e.detail.jobId, title: e.detail.title });
    };
    window.addEventListener("job-skipped", onSkipped as EventListener);
    return () => window.removeEventListener("job-skipped", onSkipped as EventListener);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(() => {
    if (!pending) return;
    timerRef.current = setTimeout(() => {
      if (token) commitSkip({ jobId: pending.jobId });
      setPending(null);
      timerRef.current = null;
    }, 3200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.jobId]);

  if (!pending) return null;

  return (
    <UndoToast
      key={pending.jobId}
      title={pending.title}
      onUndo={() => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
        undoSkip(pending.jobId);
        setPending(null);
      }}
      onExpire={() => {
        if (token) commitSkip({ jobId: pending.jobId });
        setPending(null);
      }}
    />
  );
}

/* ── Landscape suggestion banner (mobile + desktop mode) ─────────── */
function LandscapeBanner() {
  const [portrait, setPortrait] = useState(
    () => window.matchMedia("(orientation: portrait)").matches
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(orientation: portrait)");
    const handler = (e: MediaQueryListEvent) => setPortrait(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (!portrait || dismissed) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px",
      background: "rgba(0,0,0,0.92)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      fontSize: 12, color: "rgba(255,255,255,0.7)",
      fontFamily: "JetBrains Mono, monospace",
      letterSpacing: "0.05em",
    }}>
      <span>⟳ Rotate to landscape for the best experience</span>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer" }}
      >
        ✕
      </button>
    </div>
  );
}

/* ── Phone frame wrapper (desktop + phone mode) ──────────────────── */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "#0d0d0d",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {/* Subtle background grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />

      {/* Phone shell */}
      <div style={{
        position: "relative",
        width: 390,
        height: "min(844px, 100svh)",
        borderRadius: 44,
        overflow: "hidden",
        boxShadow: "0 0 0 10px #1c1c1e, 0 0 0 11px rgba(255,255,255,0.08), 0 40px 120px rgba(0,0,0,0.9)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}>
        {children}
      </div>
    </div>
  );
}

/* ── App inner (reads view mode context) ─────────────────────────── */
function AppInner() {
  const { mode, physicallyMobile } = useViewMode();
  const [loading, setLoading] = useState(!HAS_LOADED);

  const routes = (
    <>
      {loading && (
        <LoadingScreen onDone={() => {
          sessionStorage.setItem("ja-loaded", "1");
          setLoading(false);
        }} />
      )}

      <BrowserRouter>
        <NoiseOverlay />
        <SimpleCursor />
        <GlobalSkipManager />

        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route element={<Shell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </>
  );

  // Desktop user → phone mode: wrap in centered phone frame
  if (mode === "phone" && !physicallyMobile) {
    return <PhoneFrame>{routes}</PhoneFrame>;
  }

  // Mobile user → desktop mode: show landscape suggestion banner
  if (mode === "desktop" && physicallyMobile) {
    return (
      <>
        <LandscapeBanner />
        {routes}
      </>
    );
  }

  return <>{routes}</>;
}

/* ── Root ────────────────────────────────────────────────────────── */
export default function App() {
  return (
    <ViewModeProvider>
      <AppInner />
    </ViewModeProvider>
  );
}

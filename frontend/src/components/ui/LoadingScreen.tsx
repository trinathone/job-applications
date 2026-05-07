import { useEffect, useRef, useState } from "react";

const LINES = [
  "initializing workspace",
  "fetching job index",
  "loading filters",
  "ready",
];

export default function LoadingScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress]       = useState(0);
  const [lineIdx, setLineIdx]         = useState(0);
  const [charIdx, setCharIdx]         = useState(0);
  const [exiting, setExiting]         = useState(false);
  const [showCursor, setShowCursor]   = useState(true);
  const doneRef = useRef(false);

  // Blink cursor
  useEffect(() => {
    const id = setInterval(() => setShowCursor(v => !v), 530);
    return () => clearInterval(id);
  }, []);

  // Progress ticker: 0 → 100 in ~1500ms with easing
  useEffect(() => {
    const duration = 1500;
    const start    = Date.now();
    const id = setInterval(() => {
      const t   = Math.min(1, (Date.now() - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const p = Math.round(eased * 100);
      setProgress(p);
      if (p >= 100 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(id);
        setTimeout(() => {
          setExiting(true);
          setTimeout(onDone, 480);
        }, 200);
      }
    }, 16);
    return () => clearInterval(id);
  }, [onDone]);

  // Typewriter: cycle through LINES in sync with progress
  useEffect(() => {
    const targetLine = Math.min(
      LINES.length - 1,
      Math.floor((progress / 100) * LINES.length),
    );
    if (targetLine !== lineIdx) {
      setLineIdx(targetLine);
      setCharIdx(0);
    }
  }, [progress, lineIdx]);

  useEffect(() => {
    if (charIdx >= LINES[lineIdx].length) return;
    const id = setTimeout(() => setCharIdx(c => c + 1), 28);
    return () => clearTimeout(id);
  }, [charIdx, lineIdx]);

  const displayText  = LINES[lineIdx].slice(0, charIdx);
  const padded       = String(progress).padStart(3, "0");

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "var(--bg)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
        animation: exiting ? "loadingExit 0.48s cubic-bezier(0.4,0,1,1) forwards" : "none",
      }}
    >
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
      }} />

      {/* Scan line */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
        animation: "scanline 2.4s linear infinite",
        pointerEvents: "none",
      }} />

      {/* ─── Center content ─── */}
      <div style={{ position: "relative", textAlign: "center", userSelect: "none" }}>

        {/* Logo */}
        <div
          style={{
            fontFamily: "Syne, sans-serif",
            fontSize: 88, fontWeight: 800,
            color: "var(--text-1)", letterSpacing: "-0.04em",
            lineHeight: 1,
            animation: "loadFadeIn 0.6s cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          JA
        </div>

        {/* Thin rule */}
        <div style={{
          height: 1, background: "rgba(255,255,255,0.08)",
          marginTop: 28, marginBottom: 22,
          animation: "loadFadeIn 0.5s 0.15s cubic-bezier(0.16,1,0.3,1) both",
        }} />

        {/* Progress bar */}
        <div style={{
          width: 240, height: 1,
          background: "rgba(255,255,255,0.09)",
          borderRadius: 1, overflow: "hidden", margin: "0 auto",
          animation: "loadFadeIn 0.5s 0.2s cubic-bezier(0.16,1,0.3,1) both",
        }}>
          <div style={{
            height: "100%",
            width: `${progress}%`,
            background: "var(--text-1)",
            transition: "width 0.06s linear",
            borderRadius: 1,
          }} />
        </div>

        {/* Status line */}
        <div style={{
          marginTop: 18,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10, letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.28)",
          height: 16, display: "flex", alignItems: "center",
          justifyContent: "center", gap: 0,
          animation: "loadFadeIn 0.5s 0.25s cubic-bezier(0.16,1,0.3,1) both",
        }}>
          <span>{displayText}</span>
          <span style={{
            display: "inline-block", width: 6, height: 10,
            background: showCursor ? "rgba(255,255,255,0.28)" : "transparent",
            marginLeft: 2, borderRadius: 1,
            transition: "background 0.1s",
          }} />
        </div>

        {/* Counter */}
        <div style={{
          marginTop: 32,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 9, letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.14)",
          animation: "loadFadeIn 0.5s 0.3s cubic-bezier(0.16,1,0.3,1) both",
        }}>
          {padded}
        </div>
      </div>
    </div>
  );
}

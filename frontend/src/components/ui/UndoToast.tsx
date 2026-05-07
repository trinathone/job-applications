/**
 * UndoToast — appears briefly after a skip with an undo button.
 * A progress bar drains over DURATION ms, then onExpire fires.
 */

import { useEffect, useRef, useState } from "react";

const DURATION = 3200; // ms before undo expires

interface Props {
  title: string;
  onUndo: () => void;
  onExpire: () => void;
}

export default function UndoToast({ title, onUndo, onExpire }: Props) {
  const [pct,      setPct]     = useState(100);
  const [gone,     setGone]    = useState(false);
  const closedRef  = useRef(false);

  useEffect(() => {
    const start = performance.now();
    let id: number;
    const tick = (now: number) => {
      const p = Math.max(0, 100 - ((now - start) / DURATION) * 100);
      setPct(p);
      if (p > 0) {
        id = requestAnimationFrame(tick);
      } else if (!closedRef.current) {
        closedRef.current = true;
        setGone(true);
        setTimeout(onExpire, 260);
      }
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [onExpire]);

  function handleUndo() {
    if (closedRef.current) return;
    closedRef.current = true;
    setGone(true);
    setTimeout(onUndo, 220);
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: `translateX(-50%) translateY(${gone ? 12 : 0}px)`,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 20px",
        minWidth: 260,
        background: "var(--surface)",
        border: "1px solid var(--border-2)",
        borderRadius: 10,
        boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
        opacity: gone ? 0 : 1,
        transition: "opacity 0.24s ease, transform 0.24s ease",
        pointerEvents: gone ? "none" : "auto",
      }}
    >
      {/* Countdown bar */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 2, borderRadius: "0 0 10px 10px", overflow: "hidden",
      }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          background: "var(--text-4)",
          transition: "width 0.05s linear",
        }} />
      </div>

      {/* Label */}
      <span style={{
        fontSize: 12, lineHeight: 1.4,
        color: "var(--text-2)",
        maxWidth: 170,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        Skipped{title ? ` · ${title}` : ""}
      </span>

      {/* Undo button */}
      <button
        onClick={handleUndo}
        style={{
          marginLeft: "auto",
          flexShrink: 0,
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--text-1)",
          background: "none",
          border: "none",
          padding: "2px 0",
        }}
      >
        Undo
      </button>
    </div>
  );
}

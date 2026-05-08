/**
 * BatchTracker — 3 daily scrapes at 7am / 11am / 4pm ET.
 * Strict monochrome — no colors, only CSS var tokens.
 */
import { useState, useEffect, useRef } from "react";

const BATCH_HOURS_EST = [7, 11, 16];
const BATCH_LABELS    = ["7:00 AM", "11:00 AM", "4:00 PM"];

function nowET(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}

function getBatchInfo() {
  const et      = nowET();
  const hNow    = et.getHours() + et.getMinutes() / 60;
  const done    = BATCH_HOURS_EST.filter(h => hNow >= h).length;
  const nextIdx = BATCH_HOURS_EST.findIndex(h => hNow < h);

  let nextBatchAt: Date, nextLabel: string, nextBatchNum: number;

  if (nextIdx === -1) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(BATCH_HOURS_EST[0], 0, 0, 0);
    nextBatchAt  = tomorrow;
    nextLabel    = BATCH_LABELS[0];
    nextBatchNum = 1;
  } else {
    const today = new Date();
    today.setHours(BATCH_HOURS_EST[nextIdx], 0, 0, 0);
    nextBatchAt  = today;
    nextLabel    = BATCH_LABELS[nextIdx];
    nextBatchNum = nextIdx + 1;
  }

  return { done, nextBatchNum, nextLabel, nextBatchAt, allDone: nextIdx === -1 };
}

function fmt(ms: number) {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export default function BatchTracker() {
  const [info, setInfo]         = useState(getBatchInfo);
  const [msLeft, setMsLeft]     = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [pulse, setPulse]       = useState(false);
  const prevDone = useRef(info.done);

  useEffect(() => {
    const id = setInterval(() => {
      const next = getBatchInfo();
      setInfo(next);
      setMsLeft(next.nextBatchAt.getTime() - Date.now());
      if (next.done !== prevDone.current) {
        prevDone.current = next.done;
        setPulse(true);
        setTimeout(() => setPulse(false), 3000);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setMsLeft(info.nextBatchAt.getTime() - Date.now());
  }, [info.nextBatchAt]);

  const urgent = msLeft > 0 && msLeft < 5 * 60 * 1000;

  return (
    <div className="relative flex items-center gap-2">
      <div
        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-300 ${pulse ? "scale-105" : ""}`}
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        {/* Batch dots */}
        <div className="flex items-center gap-1">
          {BATCH_LABELS.map((_, i) => {
            const done   = i < info.done;
            const isNext = !info.allDone && i === info.done;
            return (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isNext ? "animate-pulse" : ""}`}
                style={{
                  background: done ? "var(--text-2)" : isNext ? "var(--text-1)" : "var(--text-4)",
                }}
                title={`Batch ${i + 1}: ${BATCH_LABELS[i]} ET`}
              />
            );
          })}
        </div>

        {/* Countdown / status */}
        <div className="font-mono text-[10px] tracking-wide flex items-center gap-1.5 uppercase whitespace-nowrap">
          {info.allDone ? (
            <span style={{ color: "var(--text-2)" }}>Done · 3/3</span>
          ) : (
            <>
              <span style={{ color: "var(--text-3)" }}>{info.done}/3</span>
              <span style={{ color: "var(--text-3)" }}>·</span>
              <span style={{ color: urgent ? "var(--text-1)" : "var(--text-2)" }}>
                {fmt(msLeft)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Info toggle */}
      <button
        onClick={() => setShowInfo(v => !v)}
        className="w-8 h-8 rounded flex items-center justify-center font-mono text-[11px] transition-all"
        style={{
          background: showInfo ? "var(--surface-3)" : "var(--surface-2)",
          border: "1px solid " + (showInfo ? "var(--border-2)" : "var(--border)"),
          color: showInfo ? "var(--text-1)" : "var(--text-3)",
        }}
      >
        i
      </button>

      {/* Info popup */}
      {showInfo && (
        <div
          className="absolute top-full right-0 mt-2 z-50 w-72 rounded-xl p-4 space-y-3"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
          }}
        >
          <p className="font-display text-sm font-bold" style={{ color: "var(--text-1)" }}>
            Scrape schedule
          </p>
          <div className="space-y-2">
            {BATCH_LABELS.map((label, i) => {
              const done   = i < info.done;
              const isNext = !info.allDone && i === info.done;
              return (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isNext ? "animate-pulse" : ""}`}
                      style={{ background: done ? "var(--text-2)" : isNext ? "var(--text-1)" : "var(--text-4)" }}
                    />
                    <span
                      className="font-mono text-[10px] tracking-wide uppercase"
                      style={{ color: done ? "var(--text-2)" : isNext ? "var(--text-1)" : "var(--text-3)" }}
                    >
                      Batch {i + 1}
                    </span>
                  </div>
                  <span className="font-mono text-[10px]" style={{ color: done ? "var(--text-2)" : isNext ? "var(--text-1)" : "var(--text-3)" }}>
                    {label} ET {done ? "✓" : isNext ? "← next" : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            className="pt-2 font-mono text-[8px] leading-relaxed"
            style={{ borderTop: "1px solid var(--border)", color: "var(--text-3)" }}
          >
            Jobs older than 7 days removed nightly.<br />
            Applied jobs kept indefinitely.
          </div>
        </div>
      )}
    </div>
  );
}

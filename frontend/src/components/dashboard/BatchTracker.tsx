/**
 * BatchTracker — shows which scrape batch we're on today and
 * counts down to the next one. 3 batches per day at EST times.
 */
import { useState, useEffect, useRef } from "react";

// EST = UTC-5. Scrape times in EST hours (24h)
const BATCH_HOURS_EST = [7, 11, 16]; // 7am, 11am, 4pm
const BATCH_LABELS    = ["7:00 AM", "11:00 AM", "4:00 PM"];

function nowEST(): Date {
  // Convert current UTC to EST (UTC-5)
  const utc = new Date();
  const est = new Date(utc.getTime() - 5 * 60 * 60 * 1000);
  return est;
}

function getBatchInfo() {
  const est   = nowEST();
  const hNow  = est.getUTCHours() + est.getUTCMinutes() / 60; // hours since midnight EST

  // How many batches have already run today?
  const done = BATCH_HOURS_EST.filter(h => hNow >= h).length;

  // Next batch
  const nextIdx = BATCH_HOURS_EST.findIndex(h => hNow < h);

  let nextBatchAt: Date;
  let nextLabel: string;
  let nextBatchNum: number;

  if (nextIdx === -1) {
    // All done today — next is tomorrow's first batch
    const tomorrow = new Date(est);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(BATCH_HOURS_EST[0], 0, 0, 0);
    // Convert back to UTC: add 5 hours
    nextBatchAt  = new Date(tomorrow.getTime() + 5 * 60 * 60 * 1000);
    nextLabel    = BATCH_LABELS[0];
    nextBatchNum = 1;
  } else {
    // Today's next batch
    const today = new Date(est);
    today.setUTCHours(BATCH_HOURS_EST[nextIdx], 0, 0, 0);
    nextBatchAt  = new Date(today.getTime() + 5 * 60 * 60 * 1000);
    nextLabel    = BATCH_LABELS[nextIdx];
    nextBatchNum = nextIdx + 1;
  }

  return {
    done,           // how many batches ran today
    nextBatchNum,   // 1-based index of the next batch
    nextLabel,      // "7:00 AM", "11:00 AM", "4:00 PM"
    nextBatchAt,    // UTC Date of next scrape
    allDone: nextIdx === -1,
  };
}

function fmtCountdown(ms: number): string {
  if (ms <= 0) return "any moment";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export default function BatchTracker() {
  const [info, setInfo]     = useState(getBatchInfo);
  const [msLeft, setMsLeft] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [pulse, setPulse]   = useState(false);
  const prevDone = useRef(info.done);

  useEffect(() => {
    const id = setInterval(() => {
      const next = getBatchInfo();
      setInfo(next);
      setMsLeft(next.nextBatchAt.getTime() - Date.now());

      // Pulse when a new batch completes
      if (next.done !== prevDone.current) {
        prevDone.current = next.done;
        setPulse(true);
        setTimeout(() => setPulse(false), 3000);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Initial ms
  useEffect(() => { setMsLeft(info.nextBatchAt.getTime() - Date.now()); }, [info.nextBatchAt]);

  const allDone = info.allDone;
  const urgent  = msLeft > 0 && msLeft < 5 * 60 * 1000; // < 5 min

  return (
    <div className="relative flex items-center gap-2">
      {/* Main pill */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all duration-500 ${pulse ? "scale-105" : ""}`}
        style={{
          background: pulse     ? "rgba(99,102,241,0.2)"
                    : urgent    ? "rgba(234,179,8,0.1)"
                    : allDone   ? "rgba(34,197,94,0.08)"
                    : "rgba(255,255,255,0.04)",
          border: pulse     ? "1px solid rgba(99,102,241,0.5)"
                : urgent    ? "1px solid rgba(234,179,8,0.3)"
                : allDone   ? "1px solid rgba(34,197,94,0.2)"
                : "1px solid rgba(255,255,255,0.07)",
        }}>

        {/* Batch dots */}
        <div className="flex items-center gap-1">
          {BATCH_LABELS.map((_, i) => {
            const done    = i < info.done;
            const isNext  = !allDone && i === info.done;
            return (
              <span key={i}
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  done    ? "bg-green-400"
                  : isNext ? "bg-blue-400 animate-pulse"
                  : "bg-gray-700"
                }`}
                title={`Batch ${i+1}: ${BATCH_LABELS[i]} EST`}
              />
            );
          })}
        </div>

        {/* Text */}
        <div className="flex items-center gap-1.5">
          {allDone ? (
            <span style={{ color: "rgba(74,222,128,0.8)" }}>
              All 3 batches done
            </span>
          ) : (
            <>
              <span style={{ color: "rgba(148,163,184,0.6)" }}>
                Batch {info.done}/{BATCH_LABELS.length}
              </span>
              <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
              <span style={{ color: urgent ? "#fbbf24" : "#60a5fa" }}>
                {fmtCountdown(msLeft)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Info button */}
      <button onClick={() => setShowInfo(v => !v)}
        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all duration-200"
        style={{
          background: showInfo ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: showInfo ? "#a5b4fc" : "rgba(148,163,184,0.4)",
        }}>
        i
      </button>

      {/* Info popup */}
      {showInfo && (
        <div className="absolute top-full right-0 mt-2 z-50 w-64 rounded-xl p-4 text-xs space-y-3"
          style={{
            background: "rgba(10,12,22,0.97)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          }}>
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm" style={{ color: "#e2e8f0" }}>Daily Scrape Schedule</span>
          </div>
          <div className="space-y-2">
            {BATCH_LABELS.map((label, i) => {
              const done = i < info.done;
              const isNext = !allDone && i === info.done;
              return (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${done ? "bg-green-400" : isNext ? "bg-blue-400 animate-pulse" : "bg-gray-700"}`}/>
                    <span style={{ color: done ? "#4ade80" : isNext ? "#60a5fa" : "rgba(148,163,184,0.5)" }}>
                      Batch {i + 1}
                    </span>
                  </div>
                  <span style={{ color: done ? "#4ade80" : isNext ? "#60a5fa" : "rgba(148,163,184,0.35)" }}>
                    {label} EST {done ? "✓" : isNext ? "← next" : ""}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", color: "rgba(148,163,184,0.45)" }}>
            Jobs older than 7 days are removed nightly. Applied jobs are kept forever.
          </div>
        </div>
      )}
    </div>
  );
}

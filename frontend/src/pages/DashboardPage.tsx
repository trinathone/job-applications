import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useJobs } from "../hooks/useJobs";
import { useKeyboard } from "../hooks/useKeyboard";
import { useSSE } from "../hooks/useSSE";
import { useJobStore } from "../store/jobStore";
import { useFilterStore } from "../store/filterStore";
import { applyFilters } from "../utils/jobFilters";
import { useResumeStore } from "../store/resumeStore";
import { fetchJobs } from "../api/jobs";
import JobFeed from "../components/dashboard/JobFeed";
import FilterBar from "../components/dashboard/FilterBar";
import JobDetailPanel from "../components/dashboard/JobDetailPanel";
import RightSidebar from "../components/sidebar/RightSidebar";
import BatchTracker from "../components/dashboard/BatchTracker";
import { Spinner } from "../components/ui/Spinner";
import type { ScrapeCompletePayload } from "../types/sse";
import { useViewMode } from "../context/ViewModeContext";
import { Link } from "react-router-dom";

const PANEL_MIN = 300;
const PANEL_MAX = 720;
const PANEL_DEFAULT = 460;
const LIST_MIN = 320;

/** Compact number: 200 → "200", 1200 → "1.2k", 12000 → "12k" */
function fmt(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.floor(n / 1000)}k`;
}

function MarqueeTicker({ total, newCount }: { total: number; newCount: number }) {
  const segments = [
    `${fmt(total)} jobs indexed`,
    newCount > 0 ? `+${newCount} new — click to load` : null,
    "cloud scrape: daily at 12:00 UTC",
    "press A to open · S to skip",
    "7-day rolling window",
  ].filter(Boolean).join("   ·   ");
  const text = (segments + "   ·   ").repeat(6);
  return (
    <div style={{ overflow: "hidden", flexShrink: 0, borderBottom: "1px solid var(--border)" }}>
      <p className="animate-marquee type-mono" style={{ padding: "6px 0", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {text}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const setJobs       = useJobStore((s) => s.setJobs);
  const appendJobs    = useJobStore((s) => s.appendJobs);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const newJobCount   = useJobStore((s) => s.newJobCount);
  const resetNewCount = useJobStore((s) => s.resetNewCount);
  const skipJobStore  = useJobStore((s) => s.skipJob);

  const jobs          = useJobStore((s) => s.jobs);
  const appliedJobIds = useJobStore((s) => s.appliedJobIds);
  const skippedJobIds = useJobStore((s) => s.skippedJobIds);
  const filters       = useFilterStore();
  const setFilter     = useFilterStore((s) => s.set);
  const resumeParsed  = useResumeStore((s) => s.parsed);

  const filteredJobs = useMemo(
    () => applyFilters(jobs, filters, resumeParsed, appliedJobIds, skippedJobIds),
    [jobs, filters, resumeParsed, appliedJobIds, skippedJobIds],
  );

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  const serverFilters = useMemo((): import("../api/jobs").JobFilters => ({
    ats:     filters.ats || undefined,
    remote:  filters.remote === "remote" ? true : filters.remote === "onsite" ? false : undefined,
    yoe_max: filters.yoeMax ?? undefined,
    limit:   200,
  }), [filters.ats, filters.remote, filters.yoeMax]);

  const { data, isLoading, refetch } = useJobs(serverFilters);
  const cursorRef = useRef<string | null>(null);
  const [hasMore, setHasMore]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (data?.items) {
      setJobs(data.items);
      cursorRef.current = data.cursor ?? null;
      setHasMore(!!data.cursor);
    }
  }, [data, setJobs]);

  const loadMore = useCallback(async () => {
    if (!cursorRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await fetchJobs({ ...serverFilters, cursor: cursorRef.current });
      appendJobs(next.items);
      cursorRef.current = next.cursor ?? null;
      setHasMore(!!next.cursor);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, serverFilters, appendJobs]);

  useSSE("/api/dashboard/stream", (eventType, payload) => {
    if (eventType === "scrape_complete") {
      const p = payload as ScrapeCompletePayload;
      if (p.jobs_new > 0) refetch();
    }
  });

  // Keyboard: A = open apply URL, S = skip
  useKeyboard(
    () => {
      if (selectedJob) window.open(selectedJob.url, "_blank", "noopener,noreferrer");
    },
    () => {
      if (selectedJobId === null) return;
      skipJobStore(selectedJobId);
      window.dispatchEvent(new CustomEvent("job-skipped", {
        detail: { jobId: selectedJobId, title: selectedJob?.title ?? "" },
      }));
    },
  );

  // ── Draggable panel divider ─────────────────────────────────────
  const { isMobile } = useViewMode();
  const containerRef  = useRef<HTMLDivElement>(null);
  const [panelOpen, setPanelOpen]   = useState(() => !isMobile && window.innerWidth >= 1024);
  const [panelWidth, setPanelWidth] = useState(PANEL_DEFAULT);
  const dragging = useRef(false);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth < 1024) setPanelOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPanelWidth = rect.right - ev.clientX;
      const clamped = Math.min(
        Math.max(newPanelWidth, PANEL_MIN),
        rect.width - LIST_MIN,
        PANEL_MAX,
      );
      setPanelWidth(clamped);
    };

    const onUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  // Mobile floating sidebar
  const [floatOpen, setFloatOpen] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)", overflow: "hidden" }}>

      {/* ══ TOP SECTION — full width ═══════════════════════════════════ */}
      <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>

        {/* Header row */}
        <div style={{
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 12,
          padding: "10px 20px",
          borderBottom: "1px solid var(--border)",
        }}>
          {/* Left: count + new badge + Newest toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexShrink: 0 }}>
              {isLoading ? (
                <span style={{ color: "var(--text-4)", fontWeight: 700, fontSize: 18 }}>—</span>
              ) : (
                <>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(jobs.length)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-4)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {hasMore ? "loaded +" : "jobs"}
                  </span>
                </>
              )}
            </div>

            {newJobCount > 0 && (
              <button
                onClick={() => { refetch(); resetNewCount(); }}
                style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 8px",
                  borderRadius: 5, background: "var(--surface-2)",
                  color: "var(--text-1)", border: "1px solid var(--border-2)",
                  animation: "pulse 2s infinite",
                }}
              >
                +{newJobCount} new
              </button>
            )}

            <button
              onClick={() => setFilter({ sortBy: "date", datePosted: "all" })}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 11, fontWeight: 500,
                color: filters.sortBy === "date" ? "var(--text-1)" : "var(--text-4)",
                background: "none", border: "none",
              }}
            >
              <span style={{
                width: 5, height: 5, borderRadius: "50%", display: "inline-block",
                flexShrink: 0,
                background: filters.sortBy === "date" ? "var(--text-1)" : "var(--text-4)",
                animation: filters.sortBy === "date" ? "pulse 2s infinite" : "none",
              }} />
              Newest
            </button>
          </div>

          {/* Right: BatchTracker + kbd hints + panel toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
            {!resumeParsed && (
              <Link
                to="/resume"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 28,
                  padding: "0 10px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text-2)",
                  fontSize: 11,
                  fontWeight: 600,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Add resume for match
              </Link>
            )}
            <BatchTracker />

            <div style={{
              display: "flex", alignItems: "center", gap: 1,
              fontFamily: "JetBrains Mono", fontSize: 10, color: "var(--text-4)",
            }}>
              {["A", "S"].map(k => (
                <kbd key={k} style={{
                  padding: "2px 5px", borderRadius: 3,
                  background: "var(--surface-2)", border: "1px solid var(--border)",
                  fontSize: 9,
                }}>
                  {k}
                </kbd>
              ))}
            </div>

            {selectedJob && !isMobile && (
              <button
                onClick={() => setPanelOpen(o => !o)}
                title={panelOpen ? "Close details" : "Open details"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 28, height: 28, borderRadius: 6,
                  background: panelOpen ? "var(--surface-3)" : "var(--surface-2)",
                  border: "1px solid var(--border)",
                  color: panelOpen ? "var(--text-2)" : "var(--text-4)",
                  fontSize: 12,
                  transition: "all 0.15s",
                }}
              >
                {panelOpen ? "⇥" : "⇤"}
              </button>
            )}
          </div>
        </div>

        {/* Marquee — full width */}
        <MarqueeTicker total={jobs.length} newCount={newJobCount} />

        {/* Filter bar — full width */}
        <FilterBar total={jobs.length} showing={filteredJobs.length} />
      </div>

      {/* ══ BOTTOM SECTION — split panes ═══════════════════════════════ */}
      <div ref={containerRef} style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>

        {/* Job list */}
        <div style={{ flex: 1, minWidth: LIST_MIN, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <JobFeed jobs={filteredJobs} loading={isLoading} />
          </div>

          {hasMore && (
            <div style={{ flexShrink: 0, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
              <button
                onClick={loadMore}
                disabled={loadingMore}
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8, padding: "10px 0", borderRadius: 8,
                  fontSize: 12, fontWeight: 600,
                  color: loadingMore ? "var(--text-4)" : "var(--text-1)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  opacity: loadingMore ? 0.5 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {loadingMore
                  ? <><Spinner size={13} /> Loading more…</>
                  : `Load more  ·  ${fmt(jobs.length)} loaded`
                }
              </button>
            </div>
          )}
        </div>

        {/* Draggable divider */}
        {panelOpen && !isMobile && (
          <div
            onMouseDown={startDrag}
            style={{
              width: 5, flexShrink: 0,
              cursor: "col-resize",
              background: "var(--border)",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--border-2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--border)")}
          />
        )}

        {/* Job detail panel */}
        {panelOpen && !isMobile && (
          <div style={{
            width: panelWidth, flexShrink: 0,
            display: "flex", flexDirection: "column",
            background: "var(--bg)", overflow: "hidden",
          }}>
            <JobDetailPanel
              job={selectedJob}
              onClose={() => setPanelOpen(false)}
            />
          </div>
        )}
      </div>

      {/* ── Floating sidebar button (mobile) ─────────────────────────── */}
      <div style={{ position: "fixed", bottom: 20, right: 20, zIndex: 40, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
        {floatOpen && (
          <div className="fade-in" style={{
            width: 256, borderRadius: 14, overflow: "hidden",
            background: "var(--surface)", border: "1px solid var(--border)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.8)", maxHeight: "70vh",
          }}>
            <RightSidebar />
          </div>
        )}
        <button
          onClick={() => setFloatOpen(o => !o)}
          style={{
            width: 40, height: 40, borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14,
            background: floatOpen ? "var(--text-1)" : "var(--surface)",
            border: "1px solid var(--border)",
            color: floatOpen ? "var(--bg)" : "var(--text-3)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            transform: floatOpen ? "rotate(45deg)" : "none",
            transition: "all 0.18s",
          }}
        >
          {floatOpen ? "✕" : "✦"}
        </button>
      </div>
    </div>
  );
}

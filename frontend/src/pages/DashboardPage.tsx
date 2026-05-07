import { useEffect, useMemo, useRef, useState } from "react";
import { useJobs } from "../hooks/useJobs";
import { useKeyboard } from "../hooks/useKeyboard";
import { useSSE } from "../hooks/useSSE";
import { useJobStore } from "../store/jobStore";
import { useUIStore } from "../store/uiStore";
import { useApplyJob } from "../hooks/useApplications";
import { useFilterStore } from "../store/filterStore";
import { applyFilters } from "../utils/jobFilters";
import { useResumeStore } from "../store/resumeStore";
import { fetchJobs } from "../api/jobs";
import JobFeed from "../components/dashboard/JobFeed";
import FilterBar from "../components/dashboard/FilterBar";
import RightSidebar from "../components/sidebar/RightSidebar";
import BatchTracker from "../components/dashboard/BatchTracker";
import type { ScrapeCompletePayload } from "../types/sse";

export default function DashboardPage() {
  const setJobs = useJobStore((s) => s.setJobs);
  const appendJobs = useJobStore((s) => s.appendJobs);
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const newJobCount = useJobStore((s) => s.newJobCount);
  const resetNewCount = useJobStore((s) => s.resetNewCount);
  const openSkipModal = useUIStore((s) => s.openSkipModal);
  const { mutate: applyJob } = useApplyJob();

  const jobs = useJobStore((s) => s.jobs);
  const appliedJobIds = useJobStore((s) => s.appliedJobIds);
  const filters = useFilterStore();
  const setFilter = useFilterStore((s) => s.set);
  const resumeParsed = useResumeStore((s) => s.parsed);
  const filteredJobs = useMemo(
    () => applyFilters(jobs, filters, resumeParsed, appliedJobIds),
    [jobs, filters, resumeParsed, appliedJobIds],
  );

  // Server-side filters: ats, remote, yoe_max
  const serverFilters = useMemo((): import("../api/jobs").JobFilters => ({
    ats: filters.ats || undefined,
    remote: filters.remote === "remote" ? true : filters.remote === "onsite" ? false : undefined,
    yoe_max: filters.yoeMax ?? undefined,
    limit: 200,
  }), [filters.ats, filters.remote, filters.yoeMax]);

  const { data, isLoading, refetch } = useJobs(serverFilters);

  const cursorRef = useRef<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (data?.items) {
      setJobs(data.items);
      cursorRef.current = data.cursor ?? null;
      setHasMore(!!data.cursor);
    }
  }, [data, setJobs]);

  async function loadMore() {
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
  }

  useSSE("/api/dashboard/stream", (eventType, payload) => {
    if (eventType === "scrape_complete") {
      const p = payload as ScrapeCompletePayload;
      if (p.jobs_new > 0) refetch();
    }
  });

  useKeyboard(
    () => selectedJobId !== null && applyJob({ jobId: selectedJobId, status: "applied" }),
    () => openSkipModal()
  );

  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      {/* ── Main column ── */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* Header */}
        <header className="px-4 py-2.5 flex items-center justify-between shrink-0 gap-2 flex-wrap"
          style={{borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(10,12,22,0.92)",backdropFilter:"blur(12px)"}}>

          {/* Left: job count */}
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-sm font-semibold flex items-center gap-2" style={{color:"#f1f5f9"}}>
              {isLoading ? "Loading…" : `${jobs.length} jobs`}
              {newJobCount > 0 && (
                <button onClick={() => { refetch(); resetNewCount(); }}
                  className="text-xs font-semibold px-2 py-0.5 rounded-lg animate-pulse"
                  style={{background:"rgba(99,102,241,0.15)",color:"#a5b4fc",border:"1px solid rgba(99,102,241,0.3)"}}>
                  +{newJobCount} new ↑
                </button>
              )}
            </h1>

            {/* Newest toggle */}
            <button onClick={() => setFilter({ sortBy: "date", datePosted: "all" })}
              className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
              style={filters.sortBy === "date" ? {
                background:"rgba(34,197,94,0.1)",color:"#4ade80",border:"1px solid rgba(34,197,94,0.25)"
              } : {
                background:"rgba(255,255,255,0.04)",color:"rgba(148,163,184,0.4)",border:"1px solid rgba(255,255,255,0.06)"
              }}>
              <span className={`w-1.5 h-1.5 rounded-full ${filters.sortBy==="date" ? "bg-green-400 animate-pulse" : "bg-gray-600"}`}/>
              Newest
            </button>
          </div>

          {/* Right: batch tracker + kbd hints */}
          <div className="flex items-center gap-3 shrink-0">
            <BatchTracker />
            <div className="hidden lg:flex items-center gap-1 text-[10px]" style={{color:"rgba(148,163,184,0.35)"}}>
              <kbd className="px-1.5 py-0.5 rounded" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>A</kbd>
              <kbd className="px-1.5 py-0.5 rounded" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>S</kbd>
              <kbd className="px-1.5 py-0.5 rounded" style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)"}}>N</kbd>
            </div>
          </div>
        </header>

        <FilterBar total={jobs.length} showing={filteredJobs.length} />

        <div className="flex-1 min-h-0">
          <JobFeed jobs={filteredJobs} loading={isLoading} />
        </div>

        {hasMore && (
          <div className="px-4 py-2 shrink-0" style={{borderTop:"1px solid rgba(255,255,255,0.05)"}}>
            <button onClick={loadMore} disabled={loadingMore}
              className="w-full py-1.5 text-xs font-medium disabled:opacity-40"
              style={{color:"#60a5fa"}}>
              {loadingMore ? "Loading…" : `Load more (${jobs.length} loaded)`}
            </button>
          </div>
        )}
      </div>

      {/* ── Floating bottom-right panel button ── */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
        {/* Panel */}
        {panelOpen && (
          <div className="w-64 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background:"rgba(10,12,22,0.97)",
              backdropFilter:"blur(24px)",
              border:"1px solid rgba(255,255,255,0.08)",
              boxShadow:"0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(99,102,241,0.08)",
              maxHeight:"70vh",
            }}>
            <RightSidebar />
          </div>
        )}

        {/* Toggle button */}
        <button onClick={() => setPanelOpen(o => !o)}
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg transition-all duration-300 shadow-xl"
          style={{
            background: panelOpen
              ? "linear-gradient(135deg,#2563eb,#7c3aed)"
              : "rgba(15,18,30,0.95)",
            border: panelOpen
              ? "1px solid rgba(99,102,241,0.5)"
              : "1px solid rgba(255,255,255,0.1)",
            boxShadow: panelOpen
              ? "0 0 30px rgba(99,102,241,0.4)"
              : "0 8px 32px rgba(0,0,0,0.4)",
            transform: panelOpen ? "rotate(45deg)" : "rotate(0deg)",
          }}>
          {panelOpen ? "✕" : "✦"}
        </button>
      </div>
    </div>
  );
}

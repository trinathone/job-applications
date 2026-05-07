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

  return (
    <div className="flex h-full flex-col sm:flex-row">
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Header */}
        <header className="px-4 py-3 flex items-center justify-between shrink-0 gap-2"
          style={{borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(10,12,22,0.9)",backdropFilter:"blur(12px)"}}>
          <div className="min-w-0">
            <p className="text-[10px] text-gray-500 hidden sm:block">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-sm font-semibold text-gray-100 flex items-center gap-2 flex-wrap">
              {isLoading ? "Loading…" : `${jobs.length} jobs`}
              {newJobCount > 0 && (
                <button onClick={() => { refetch(); resetNewCount(); }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                  +{newJobCount} new ↑
                </button>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setFilter({ sortBy: "date", datePosted: "all" })}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
              style={filters.sortBy === "date" ? {
                background:"rgba(34,197,94,0.1)",color:"#4ade80",border:"1px solid rgba(34,197,94,0.25)"
              } : {
                background:"rgba(255,255,255,0.04)",color:"rgba(148,163,184,0.5)",border:"1px solid rgba(255,255,255,0.06)"
              }}>
              <span className={`w-1.5 h-1.5 rounded-full ${filters.sortBy==="date" ? "bg-green-400 animate-pulse" : "bg-gray-600"}`}/>
              <span className="hidden sm:inline">Newest</span>
            </button>
            <div className="hidden md:flex items-center gap-1.5 text-[10px]" style={{color:"rgba(148,163,184,0.4)"}}>
              <kbd className="px-1.5 py-0.5 rounded" style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)"}}>A</kbd>
              <kbd className="px-1.5 py-0.5 rounded" style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)"}}>S</kbd>
              <kbd className="px-1.5 py-0.5 rounded" style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)"}}>N</kbd>
            </div>
          </div>
        </header>

        <FilterBar total={jobs.length} showing={filteredJobs.length} />

        <div className="flex-1 flex min-h-0">
          <div className="w-full flex flex-col min-h-0">
            <div className="flex-1 min-h-0">
              <JobFeed jobs={filteredJobs} loading={isLoading} />
            </div>
            {hasMore && (
              <div className="px-4 py-2 shrink-0" style={{borderTop:"1px solid rgba(255,255,255,0.05)"}}>
                <button onClick={loadMore} disabled={loadingMore}
                  className="w-full py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                  style={{color:"#60a5fa"}}>
                  {loadingMore ? "Loading…" : `Load more (${jobs.length} loaded)`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="w-full sm:w-56 shrink-0 sm:max-h-full overflow-hidden border-t sm:border-t-0 sm:border-l"
        style={{borderColor:"rgba(255,255,255,0.05)"}}>
        <RightSidebar />
      </aside>
    </div>
  );
}

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
    <div className="flex h-full">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="px-5 py-3.5 flex items-center justify-between shrink-0" style={{borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(10,12,22,0.8)",backdropFilter:"blur(12px)"}}>
          <div>
            <p className="text-xs text-gray-500">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <h1 className="text-sm font-semibold text-gray-100">
              {isLoading ? "Loading…" : `${jobs.length} jobs`}
              {newJobCount > 0 && (
                <button
                  onClick={() => { refetch(); resetNewCount(); }}
                  className="ml-2 text-xs text-blue-400 hover:text-blue-300"
                >
                  +{newJobCount} new ↑
                </button>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilter({ sortBy: "date", datePosted: "all" })}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filters.sortBy === "date"
                  ? "bg-green-500/20 text-green-400 border border-green-500/40"
                  : "bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500"
              }`}
              title="Sort by newest — be first to apply"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${filters.sortBy === "date" ? "bg-green-400 animate-pulse" : "bg-gray-600"}`} />
              Newest first
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <kbd className="px-1 py-0.5 bg-gray-800 rounded">A</kbd> Apply
              <kbd className="px-1 py-0.5 bg-gray-800 rounded">S</kbd> Skip
              <kbd className="px-1 py-0.5 bg-gray-800 rounded">N</kbd> Next
            </div>
          </div>
        </header>

        <FilterBar total={jobs.length} showing={filteredJobs.length} />

        <div className="flex-1 flex min-h-0">
          <div className="w-full flex flex-col min-h-0 relative h-full">
            <div className="flex-1 min-h-0">
              <JobFeed jobs={filteredJobs} loading={isLoading} />
            </div>
            {hasMore && (
              <div className="border-t border-gray-800 px-4 py-2 bg-gray-950 shrink-0">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full py-1.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : `Load more jobs (${jobs.length} loaded)`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="w-60 shrink-0 border-l border-gray-800">
        <RightSidebar />
      </aside>
    </div>
  );
}

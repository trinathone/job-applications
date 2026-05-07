import { useEffect, useRef } from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import type { Job } from "../../types/job";
import JobCard from "./JobCard";
import { useJobStore } from "../../store/jobStore";
import { Spinner } from "../ui/Spinner";

interface JobFeedProps {
  jobs: Job[];
  loading?: boolean;
}

export default function JobFeed({ jobs, loading }: JobFeedProps) {
  const selectedJobId = useJobStore((s) => s.selectedJobId);
  const selectJob = useJobStore((s) => s.selectJob);
  const listRef = useRef<FixedSizeList>(null);

  // Scroll to selected job
  useEffect(() => {
    if (selectedJobId === null) return;
    const idx = jobs.findIndex((j) => j.id === selectedJobId);
    if (idx >= 0) listRef.current?.scrollToItem(idx, "smart");
  }, [selectedJobId, jobs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={32} />
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <p className="text-lg">No jobs match your filters</p>
        <p className="text-sm mt-1">Try clearing some filters above.</p>
      </div>
    );
  }

  function Row({ index, style }: ListChildComponentProps) {
    const job = jobs[index];
    return (
      <div style={style}>
        <JobCard
          job={job}
          selected={job.id === selectedJobId}
          onClick={() => selectJob(job.id)}
        />
      </div>
    );
  }

  return (
    <AutoSizer>
      {({ height, width }) => (
        <FixedSizeList
          ref={listRef}
          height={height}
          width={width}
          itemCount={jobs.length}
          itemSize={76}
          overscanCount={10}
          className="scrollbar-thin"
        >
          {Row}
        </FixedSizeList>
      )}
    </AutoSizer>
  );
}

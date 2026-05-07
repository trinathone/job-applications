import clsx from "clsx";
import type { Job } from "../../types/job";
import { ATSBadge, RemoteBadge, YOEBadge } from "../ui/Badge";
import { useApplyJob } from "../../hooks/useApplications";
import { useUIStore } from "../../store/uiStore";
import { useJobStore } from "../../store/jobStore";
import { distanceFromPA, formatDistance } from "../../utils/locationUtils";
import { useFilterStore } from "../../store/filterStore";
import { useResumeStore } from "../../store/resumeStore";
import { computeMatchScore, getScoreColor } from "../../utils/matchScore";

interface JobCardProps {
  job: Job;
  selected: boolean;
  onClick(): void;
}

export default function JobCard({ job, selected, onClick }: JobCardProps) {
  const { mutate: applyJob, isPending } = useApplyJob();
  const openSkipModal = useUIStore((s) => s.openSkipModal);
  const appliedJobIds = useJobStore((s) => s.appliedJobIds);
  const sortBy = useFilterStore((s) => s.sortBy);

  const resumeParsed = useResumeStore((s) => s.parsed);
  const matchScore = resumeParsed ? computeMatchScore(job, resumeParsed) : null;

  const isApplied = appliedJobIds.has(job.id);

  function handleApply(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isApplied) applyJob({ jobId: job.id, status: "applied" });
  }

  function handleSkip(e: React.MouseEvent) {
    e.stopPropagation();
    openSkipModal();
  }

  const salary =
    job.salary_min && job.salary_max
      ? `$${(job.salary_min / 1000).toFixed(0)}k–$${(job.salary_max / 1000).toFixed(0)}k`
      : job.salary_min
      ? `$${(job.salary_min / 1000).toFixed(0)}k+`
      : null;

  const distanceMiles = distanceFromPA(job.location);
  const showDistance = sortBy === "distance";

  const postedAgo = job.scraped_at
    ? (() => {
        const hrs = (Date.now() - new Date(job.scraped_at).getTime()) / 3_600_000;
        if (hrs < 24) return `${Math.round(hrs)}h ago`;
        const days = Math.floor(hrs / 24);
        return `${days}d ago`;
      })()
    : null;

  return (
    <div
      onClick={onClick}
      className={clsx(
        "px-4 py-3 border-b border-gray-800 cursor-pointer transition-colors select-none",
        isApplied
          ? "bg-green-950/30 border-l-2 border-l-green-600 opacity-75"
          : selected
          ? "bg-gray-800 border-l-2 border-l-blue-500"
          : "hover:bg-gray-900"
      )}
    >
      <div className="flex items-start gap-2 justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <ATSBadge ats={job.ats} />
            {job.remote && <RemoteBadge />}
            <YOEBadge min={job.yoe_min} max={job.yoe_max} />
            {salary && <span className="text-xs text-green-400">{salary}</span>}
            {postedAgo && (
              <span className="text-xs text-gray-600">{postedAgo}</span>
            )}
            {matchScore !== null && (
              <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${getScoreColor(matchScore)}`}>
                {matchScore}% match
              </span>
            )}
          </div>
          <p className="font-medium text-sm text-gray-100 truncate">{job.title}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {job.company.name}
            {job.location && ` · ${job.location}`}
            {showDistance && !job.remote && distanceMiles < 8000 && (
              <span className="text-gray-600 ml-1">
                · {formatDistance(distanceMiles)}
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-1.5 shrink-0 ml-2 items-center">
          {/* Always visible: open in ATS */}
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="px-2.5 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded font-medium border border-gray-700 whitespace-nowrap"
          >
            Open ↗
          </a>

          {isApplied ? (
            <span className="px-2.5 py-1 text-xs bg-green-900/50 text-green-400 rounded font-medium border border-green-800">
              Applied ✓
            </span>
          ) : selected ? (
            <>
              <button
                onClick={handleApply}
                disabled={isPending}
                className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-medium whitespace-nowrap"
              >
                {isPending ? "…" : "Apply (A)"}
              </button>
              <button
                onClick={handleSkip}
                className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded font-medium"
              >
                Skip (S)
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

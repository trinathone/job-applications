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

interface JobCardProps { job: Job; selected: boolean; onClick(): void; }

export default function JobCard({ job, selected, onClick }: JobCardProps) {
  const { mutate: applyJob, isPending } = useApplyJob();
  const openSkipModal = useUIStore((s) => s.openSkipModal);
  const appliedJobIds = useJobStore((s) => s.appliedJobIds);
  const sortBy        = useFilterStore((s) => s.sortBy);
  const resumeParsed  = useResumeStore((s) => s.parsed);
  const matchScore    = resumeParsed ? computeMatchScore(job, resumeParsed) : null;
  const isApplied     = appliedJobIds.has(job.id);

  function handleApply(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isApplied) applyJob({ jobId: job.id, status: "applied" });
  }
  function handleSkip(e: React.MouseEvent) { e.stopPropagation(); openSkipModal(); }

  const salary = job.salary_min && job.salary_max
    ? `$${(job.salary_min/1000).toFixed(0)}k–$${(job.salary_max/1000).toFixed(0)}k`
    : job.salary_min ? `$${(job.salary_min/1000).toFixed(0)}k+` : null;

  const distanceMiles = distanceFromPA(job.location);
  const showDistance  = sortBy === "distance";

  const postedAgo = job.scraped_at ? (() => {
    const hrs = (Date.now() - new Date(job.scraped_at).getTime()) / 3_600_000;
    if (hrs < 1) return `${Math.round(hrs*60)}m ago`;
    if (hrs < 24) return `${Math.round(hrs)}h ago`;
    return `${Math.floor(hrs/24)}d ago`;
  })() : null;

  const isFresh = job.scraped_at && (Date.now() - new Date(job.scraped_at).getTime()) < 3_600_000;

  return (
    <div onClick={onClick} className={clsx(
      "px-4 py-3.5 cursor-pointer select-none transition-all duration-150 group relative",
      "border-b",
      isApplied  ? "opacity-60" : "",
      selected   ? "" : "hover:bg-white/[0.02]",
    )} style={{
      borderBottomColor: "rgba(255,255,255,0.05)",
      borderLeft: isApplied ? "2px solid rgba(34,197,94,0.5)"
        : selected ? "2px solid rgba(99,102,241,0.8)" : "2px solid transparent",
      background: isApplied ? "rgba(34,197,94,0.03)"
        : selected ? "rgba(99,102,241,0.06)" : "transparent",
    }}>
      <div className="flex items-start gap-3 justify-between">
        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            {isFresh && (
              <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded"
                style={{background:"rgba(34,197,94,0.15)",color:"#4ade80",border:"1px solid rgba(34,197,94,0.2)"}}>
                NEW
              </span>
            )}
            <ATSBadge ats={job.ats} />
            {job.remote && <RemoteBadge />}
            <YOEBadge min={job.yoe_min} max={job.yoe_max} />
            {salary && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{background:"rgba(34,197,94,0.1)",color:"#4ade80"}}>
                {salary}
              </span>
            )}
            {postedAgo && (
              <span className="text-[10px]" style={{color:"rgba(148,163,184,0.4)"}}>
                {postedAgo}
              </span>
            )}
            {matchScore !== null && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${getScoreColor(matchScore)}`}>
                {matchScore}%
              </span>
            )}
          </div>

          {/* Title */}
          <p className="font-semibold text-sm truncate" style={{color:"#f1f5f9"}}>
            {job.title}
          </p>

          {/* Company / location */}
          <p className="text-xs mt-0.5 truncate" style={{color:"rgba(148,163,184,0.6)"}}>
            {job.company.name}
            {job.location && ` · ${job.location}`}
            {showDistance && !job.remote && distanceMiles < 8000 && (
              <span style={{color:"rgba(148,163,184,0.35)"}}> · {formatDistance(distanceMiles)}</span>
            )}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1.5 shrink-0 ml-2 items-center">
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            onClick={e=>e.stopPropagation()}
            className="px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-150"
            style={{background:"rgba(255,255,255,0.05)",color:"rgba(148,163,184,0.8)",border:"1px solid rgba(255,255,255,0.07)"}}>
            Open ↗
          </a>

          {isApplied ? (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-lg"
              style={{background:"rgba(34,197,94,0.1)",color:"#4ade80",border:"1px solid rgba(34,197,94,0.2)"}}>
              Applied ✓
            </span>
          ) : selected ? (
            <>
              <button onClick={handleApply} disabled={isPending}
                className="px-2.5 py-1 text-xs font-semibold text-white rounded-lg transition-all duration-150 disabled:opacity-40"
                style={{background:"linear-gradient(135deg,#2563eb,#7c3aed)",boxShadow:"0 2px 12px rgba(99,102,241,0.3)"}}>
                {isPending ? "…" : "Apply (A)"}
              </button>
              <button onClick={handleSkip}
                className="px-2.5 py-1 text-xs font-medium rounded-lg transition-all duration-150"
                style={{background:"rgba(255,255,255,0.05)",color:"rgba(148,163,184,0.7)",border:"1px solid rgba(255,255,255,0.07)"}}>
                Skip (S)
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

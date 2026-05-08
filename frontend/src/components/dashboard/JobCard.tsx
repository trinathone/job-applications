import { useRef, useState } from "react";
import type { Job } from "../../types/job";
import { useJobStore } from "../../store/jobStore";
import { distanceFromPA, formatDistance } from "../../utils/locationUtils";
import { useFilterStore } from "../../store/filterStore";
import { useResumeStore } from "../../store/resumeStore";
import { computeMatchScore } from "../../utils/matchScore";
import { detectJobType, JOB_TYPE_LABEL } from "../../utils/jobType";

interface Props { job: Job; selected: boolean; onClick(): void; }

function freshnessTime(job: Job): string {
  return job.posted_at ?? job.scraped_at;
}

function postedLabel(iso: string): string {
  const hrs = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hrs < 1)  return `${Math.round(hrs * 60)}m`;
  if (hrs < 24) return `${Math.round(hrs)}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function Chip({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return (
    <span style={{
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 9, fontWeight: bold ? 600 : 400,
      letterSpacing: "0.06em", textTransform: "uppercase",
      padding: "2px 6px", borderRadius: 4,
      background: "var(--surface-2)",
      color: "var(--text-3)",
      border: "1px solid var(--border)",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

export default function JobCard({ job, selected, onClick }: Props) {
  const skipJobStore  = useJobStore((s) => s.skipJob);
  const appliedJobIds = useJobStore((s) => s.appliedJobIds);
  const sortBy        = useFilterStore((s) => s.sortBy);
  const resumeParsed  = useResumeStore((s) => s.parsed);
  const matchScore    = resumeParsed ? computeMatchScore(job, resumeParsed) : null;
  const isApplied     = appliedJobIds.has(job.id);
  const jobType       = detectJobType(job.title);

  const [skipping, setSkipping] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const visibleDate = freshnessTime(job);
  const isFresh = (Date.now() - new Date(visibleDate).getTime()) < 3_600_000;

  const salary = job.salary_min && job.salary_max
    ? `$${(job.salary_min / 1000).toFixed(0)}k–$${(job.salary_max / 1000).toFixed(0)}k`
    : job.salary_min ? `$${(job.salary_min / 1000).toFixed(0)}k+` : null;

  const distanceMiles = distanceFromPA(job.location);
  const showDistance  = sortBy === "distance";

  function triggerSkip() {
    if (skipping) return;
    setSkipping(true);
    // Wait for throw animation to finish before updating the list
    setTimeout(() => {
      skipJobStore(job.id);
      window.dispatchEvent(new CustomEvent("job-skipped", {
        detail: { jobId: job.id, title: job.title },
      }));
    }, 300);
  }

  function handleSkipClick(e: React.MouseEvent) {
    e.stopPropagation();
    triggerSkip();
  }

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={skipping ? "job-skip-anim" : ""}
      style={{
        position: "relative",
        borderBottom: "1px solid var(--border)",
        borderLeft: selected
          ? "2px solid var(--text-1)"
          : isApplied
          ? "2px solid var(--border-2)"
          : "2px solid transparent",
        background: selected ? "var(--accent-bg)" : "transparent",
        padding: "12px 16px 12px 14px",
        opacity: isApplied ? 0.35 : 1,
        transition: "background 0.12s, opacity 0.12s",
      }}
      onMouseEnter={e => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.background = "var(--surface)";
      }}
      onMouseLeave={e => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, justifyContent: "space-between" }}>
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
            {isFresh && (
              <span style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 8,
                fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "1px 5px", borderRadius: 3,
                background: "var(--surface-3)",
                color: "var(--text-2)",
                border: "1px solid var(--border-2)",
                flexShrink: 0,
              }}>
                new
              </span>
            )}
            <p style={{
              fontSize: 13.5, fontWeight: 600, lineHeight: 1.3,
              letterSpacing: "-0.005em",
              color: "var(--text-1)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {job.title}
            </p>
          </div>

          {/* Company · Location */}
          <p style={{
            fontSize: 12, lineHeight: 1.4, color: "var(--text-3)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            marginBottom: 8,
          }}>
            <span style={{ fontWeight: 500, color: "var(--text-2)" }}>{job.company.name}</span>
            {job.location && <span> · {job.location}</span>}
            {showDistance && !job.remote && distanceMiles < 8000 && (
              <span> · {formatDistance(distanceMiles)}</span>
            )}
          </p>

          {/* Chips */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <Chip bold>{JOB_TYPE_LABEL[jobType]}</Chip>
            {job.ats && <Chip>{job.ats.replace(/_/g, " ")}</Chip>}
            {job.remote && <Chip bold>Remote</Chip>}
            {(job.yoe_min !== null || job.yoe_max !== null) && (
              <Chip>
                {job.yoe_min === job.yoe_max || job.yoe_max === null
                  ? `${job.yoe_min}y`
                  : `${job.yoe_min}–${job.yoe_max}y`}
              </Chip>
            )}
            {salary && <Chip bold>{salary}</Chip>}
            {resumeParsed && (
              <Chip>{matchScore !== null ? `${matchScore}%` : "—"}</Chip>
            )}
            {visibleDate && (
              <span style={{
                fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                color: "var(--text-4)", marginLeft: "auto",
              }}>
                {postedLabel(visibleDate)}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "flex-start", paddingTop: 2 }}>
          {isApplied ? (
            <span style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 9, fontWeight: 600, letterSpacing: "0.06em",
              padding: "3px 8px", borderRadius: 5,
              background: "var(--surface-2)", color: "var(--text-2)",
              border: "1px solid var(--border)",
              whiteSpace: "nowrap", alignSelf: "center",
            }}>
              ✓ applied
            </span>
          ) : selected ? (
            <>
              {/* Opens external job posting */}
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  padding: "4px 11px", borderRadius: 6,
                  fontSize: 11, fontWeight: 600,
                  background: "var(--text-1)", color: "var(--bg)",
                  textDecoration: "none", whiteSpace: "nowrap",
                }}
              >
                Apply ↗
              </a>
              <button
                onClick={handleSkipClick}
                style={{
                  padding: "4px 10px", borderRadius: 6,
                  fontSize: 11, fontWeight: 500,
                  background: "transparent", color: "var(--text-3)",
                  border: "1px solid var(--border)", whiteSpace: "nowrap",
                }}
              >
                Skip
              </button>
            </>
          ) : (
            /* Non-selected: just the external link icon */
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 26, height: 26, borderRadius: 6, fontSize: 12,
                background: "var(--surface-2)", color: "var(--text-4)",
                border: "1px solid var(--border)", textDecoration: "none",
              }}
            >
              ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

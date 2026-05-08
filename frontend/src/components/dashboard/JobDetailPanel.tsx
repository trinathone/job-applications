import { useState } from "react";
import type { Job } from "../../types/job";
import { useApplyJob } from "../../hooks/useApplications";
import { useJobStore } from "../../store/jobStore";
import { useResumeStore } from "../../store/resumeStore";
import { computeMatchScore } from "../../utils/matchScore";
import { detectJobType, JOB_TYPE_LABEL } from "../../utils/jobType";

interface Props { job: Job | null; onClose?: () => void }

function dateLabel(job: Job) {
  const dateStr = job.posted_at ?? job.scraped_at;
  const prefix = job.posted_at ? "Posted" : "Found";
  const hrs = (Date.now() - new Date(dateStr).getTime()) / 3_600_000;
  if (hrs < 1)  return `${prefix} ${Math.max(1, Math.round(hrs * 60))} min ago`;
  if (hrs < 24) return `${prefix} ${Math.round(hrs)} hr ago`;
  if (hrs < 24 * 7) return `${prefix} ${Math.floor(hrs / 24)} days ago`;
  return `${prefix} ${new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function MetaCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 8, padding: "10px 12px",
    }}>
      <p style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 9, fontWeight: 600, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--text-4)", marginBottom: 6,
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function MetaText({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>
      {children}
    </span>
  );
}

export default function JobDetailPanel({ job, onClose }: Props) {
  const { mutate: applyJob, isPending } = useApplyJob();
  const skipJobStore  = useJobStore((s) => s.skipJob);
  const appliedJobIds = useJobStore((s) => s.appliedJobIds);
  const resumeParsed  = useResumeStore((s) => s.parsed);
  const [skipping, setSkipping] = useState(false);

  // Panel top bar (always shown when panel is open)
  const topBar = (
    <div style={{
      flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 12px 8px 16px",
      borderBottom: "1px solid var(--border)",
      background: "var(--surface)",
    }}>
      <span style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 9, fontWeight: 600, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--text-4)",
      }}>
        {job ? "Job details" : "Details"}
      </span>
      {onClose && (
        <button
          onClick={onClose}
          title="Close panel"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 24, height: 24, borderRadius: 5,
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-4)",
            fontSize: 11, lineHeight: 1,
            transition: "all 0.12s",
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-4)";
          }}
        >
          ✕
        </button>
      )}
    </div>
  );

  if (!job) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {topBar}
        <div style={{
          flex: 1,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 12, userSelect: "none",
          color: "var(--text-4)",
        }}>
          <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <rect x="3" y="7" width="18" height="13" rx="2"/>
            <path d="M8 7V5a2 2 0 0 1 4 0v2M16 7V5a2 2 0 0 0-4 0v2"/>
            <path d="M8 12h8M8 16h5" strokeLinecap="round"/>
          </svg>
          <p style={{ fontSize: 12, color: "var(--text-4)" }}>Select a job to see details</p>
        </div>
      </div>
    );
  }

  const isApplied  = appliedJobIds.has(job.id);
  const matchScore = resumeParsed ? computeMatchScore(job, resumeParsed) : null;
  const jobType    = detectJobType(job.title);

  const salary = job.salary_min && job.salary_max
    ? `$${(job.salary_min / 1000).toFixed(0)}k – $${(job.salary_max / 1000).toFixed(0)}k / yr`
    : job.salary_min
    ? `$${(job.salary_min / 1000).toFixed(0)}k+ / yr`
    : null;

  function handleSkip() {
    if (skipping) return;
    setSkipping(true);
    skipJobStore(job!.id);
    window.dispatchEvent(new CustomEvent("job-skipped", {
      detail: { jobId: job!.id, title: job!.title },
    }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {topBar}
      <div className="scrollbar-thin" style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>

        {/* Title */}
        <h2 style={{
          fontSize: 20, fontWeight: 700, lineHeight: 1.25,
          color: "var(--text-1)", marginBottom: 6, letterSpacing: "-0.02em",
        }}>
          {job.title}
        </h2>

        {/* Company · location */}
        <p style={{ fontSize: 14, color: "var(--text-3)", marginBottom: 24 }}>
          <span style={{ fontWeight: 600, color: "var(--text-2)" }}>{job.company.name}</span>
          {job.location && <span> · {job.location}</span>}
        </p>

        {/* Metadata grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
          <MetaCard label="Type">
            <MetaText>{JOB_TYPE_LABEL[jobType]}</MetaText>
          </MetaCard>

          <MetaCard label="Source">
            <MetaText>{job.ats.replace(/_/g, " ")}</MetaText>
          </MetaCard>

          {job.remote !== null && (
            <MetaCard label="Work mode">
              <MetaText>{job.remote ? "Remote" : "On-site"}</MetaText>
            </MetaCard>
          )}

          {(job.yoe_min !== null || job.yoe_max !== null) && (
            <MetaCard label="Experience">
              <MetaText>
                {job.yoe_min === job.yoe_max || job.yoe_max === null
                  ? `${job.yoe_min} yr`
                  : `${job.yoe_min}–${job.yoe_max} yr`}
              </MetaText>
            </MetaCard>
          )}

          {salary && (
            <MetaCard label="Salary">
              <MetaText>{salary}</MetaText>
            </MetaCard>
          )}

          <MetaCard label="Resume match">
            <span style={{
              fontFamily: "JetBrains Mono, monospace", fontSize: 12,
              color: matchScore !== null ? "var(--text-1)" : "var(--text-4)",
              fontWeight: matchScore !== null ? 600 : 400,
            }}>
              {matchScore !== null ? `${matchScore}%` : "—"}
            </span>
          </MetaCard>

          <MetaCard label="Posted">
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-3)" }}>
              {dateLabel(job)}
            </span>
          </MetaCard>
        </div>

        {/* Resume match bar */}
        {matchScore !== null && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 9, fontWeight: 600, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "var(--text-4)",
              }}>
                Resume alignment
              </span>
              <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--text-3)" }}>
                {matchScore}%
              </span>
            </div>
            <div style={{ height: 2, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${matchScore}%`, borderRadius: 99,
                background: "var(--text-1)",
                transition: "width 0.5s cubic-bezier(0.16,1,0.3,1)",
              }} />
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: "var(--border)", marginBottom: 20 }} />

        {/* ── Apply flow ─────────────────────────────────────────────────── */}
        {isApplied ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, padding: "14px 0",
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 13, fontWeight: 600, color: "var(--text-2)",
              border: "1px solid var(--border)", borderRadius: 10,
              background: "var(--surface)",
            }}>
              ✓ Saved to applied jobs
            </div>
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", fontSize: 14, padding: "12px 18px" }}
            >
              Reopen application ↗
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Primary: open the real job portal */}
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{ width: "100%", justifyContent: "center", fontSize: 14, padding: "12px 18px" }}
            >
              Apply on {job.company.name} ↗
            </a>

            {/* Secondary: mark as applied inside the app */}
            <button
              onClick={() => applyJob({ job, status: "applied" })}
              disabled={isPending}
              className="btn-ghost"
              style={{ width: "100%", justifyContent: "center", fontSize: 13, padding: "11px 18px" }}
            >
              {isPending ? "Saving…" : "✓ I applied"}
            </button>
          </div>
        )}

        {/* Skip — shown only when not yet applied */}
        {!isApplied && (
          <button
            onClick={handleSkip}
            disabled={skipping}
            style={{
              marginTop: 12, width: "100%", padding: "8px 0",
              fontSize: 11, color: "var(--text-4)",
              background: "none", border: "none",
              fontFamily: "JetBrains Mono, monospace",
              letterSpacing: "0.06em", textTransform: "uppercase",
              opacity: skipping ? 0.3 : 1,
              transition: "opacity 0.15s",
            }}
          >
            Skip (S)
          </button>
        )}
      </div>
    </div>
  );
}

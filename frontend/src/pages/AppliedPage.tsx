import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { useJobStore } from "../store/jobStore";

function timeAgo(dateStr: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AppliedPage() {
  const appliedJobs = useJobStore((s) => s.appliedJobs);
  const removeApplied = useJobStore((s) => s.removeApplied);

  return (
    <main style={{ height: "100%", overflow: "auto", background: "var(--bg)", color: "var(--text-1)" }}>
      <section style={{
        minHeight: "100%",
        padding: "clamp(16px, 4vw, 44px)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}>
        <div style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <div>
            <p style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 10,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--text-4)",
              marginBottom: 8,
            }}>
              applied tracker
            </p>
            <h1 style={{ fontSize: "clamp(30px, 5vw, 58px)", lineHeight: 1, fontWeight: 900 }}>
              Your applied jobs
            </h1>
          </div>
          <Link
            to="/dashboard"
            style={{
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 14px",
              borderRadius: 8,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-1)",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Back to board
          </Link>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 12,
        }}>
          <div style={statStyle}>
            <span style={statLabelStyle}>Total</span>
            <strong style={statValueStyle}>{appliedJobs.length}</strong>
          </div>
          <div style={statStyle}>
            <span style={statLabelStyle}>Latest</span>
            <strong style={statValueStyle}>{appliedJobs[0] ? timeAgo(appliedJobs[0].appliedAt) : "—"}</strong>
          </div>
        </div>

        {appliedJobs.length === 0 ? (
          <div style={{
            flex: 1,
            minHeight: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface)",
            textAlign: "center",
            padding: 24,
          }}>
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>No applied jobs yet.</p>
              <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 18 }}>
                Open a job, apply, then tap “I applied”. It will stay here after refresh.
              </p>
              <Link to="/dashboard" style={{ color: "var(--text-1)", fontWeight: 800 }}>
                Start applying
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {appliedJobs.map((job) => (
              <article
                key={job.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 14,
                  alignItems: "center",
                  padding: "14px",
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <h2 style={{
                    fontSize: 15,
                    lineHeight: 1.25,
                    fontWeight: 800,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {job.title}
                  </h2>
                  <p style={{
                    marginTop: 5,
                    fontSize: 12,
                    color: "var(--text-3)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {job.companyName}{job.location ? ` · ${job.location}` : ""}{job.remote ? " · Remote" : ""}
                  </p>
                  <p style={{
                    marginTop: 8,
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 10,
                    color: "var(--text-4)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}>
                    {job.ats.replace(/_/g, " ")} · applied {timeAgo(job.appliedAt)}
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={actionStyle}
                  >
                    Open ↗
                  </a>
                  <button
                    onClick={() => removeApplied(job.id)}
                    style={{ ...actionStyle, background: "transparent", color: "var(--text-3)" }}
                  >
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const statStyle: CSSProperties = {
  padding: 14,
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
};

const statLabelStyle: CSSProperties = {
  display: "block",
  fontFamily: "JetBrains Mono, monospace",
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--text-4)",
  marginBottom: 8,
};

const statValueStyle: CSSProperties = {
  fontSize: 26,
  lineHeight: 1,
};

const actionStyle: CSSProperties = {
  minHeight: 42,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--text-1)",
  color: "var(--bg)",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 800,
};

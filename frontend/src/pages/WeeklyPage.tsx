import { useQuery } from "@tanstack/react-query";
import { listApplications } from "../api/applications";
import type { Application } from "../types/application";

export default function WeeklyPage() {
  const { data: apps = [], isLoading } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: listApplications,
  });

  const now    = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const thisWeek = apps.filter((a) => new Date(a.session_date) >= monday);
  const allTime  = apps.filter((a) => a.status === "applied");

  const byStatus = thisWeek.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div
      className="h-full overflow-y-auto scrollbar-thin"
      style={{ background: "var(--bg)" }}
    >
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold mb-1" style={{ color: "var(--text-1)" }}>
            Weekly Review
          </h1>
          <p className="font-mono text-[10px] tracking-widest uppercase" style={{ color: "var(--text-3)" }}>
            Week of {monday.toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <StatCard label="Applied this week" value={byStatus.applied ?? 0} />
          <StatCard label="Interviewing"       value={byStatus.interviewing ?? 0} />
          <StatCard label="Offers"             value={byStatus.offer ?? 0} />
          <StatCard label="Rejected"           value={byStatus.rejected ?? 0} />
        </div>

        {/* All-time count */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: "var(--text-3)" }}>
            All-time applied
          </span>
          <span className="font-display text-xl font-bold" style={{ color: "var(--text-1)" }}>
            {allTime.length}
          </span>
        </div>

        {/* This week's applications */}
        <h2 className="font-mono text-[10px] tracking-widest uppercase mb-3" style={{ color: "var(--text-3)" }}>
          This week · {thisWeek.length} {thisWeek.length === 1 ? "application" : "applications"}
        </h2>

        {isLoading ? (
          <p className="font-mono text-[10px] tracking-widest" style={{ color: "var(--text-3)" }}>Loading…</p>
        ) : thisWeek.length === 0 ? (
          <div
            className="px-4 py-6 rounded-xl text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <p className="font-mono text-[10px] tracking-widest uppercase" style={{ color: "var(--text-3)" }}>
              No applications this week yet
            </p>
            <p className="font-mono text-[9px] mt-1" style={{ color: "var(--text-3)", opacity: 0.5 }}>
              Press A on a job in the Board to apply
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {thisWeek.map((a) => (
              <ApplicationRow key={a.id} app={a} />
            ))}
          </div>
        )}

        {/* All applied (outside this week) */}
        {apps.filter((a) => a.status === "applied" && new Date(a.session_date) < monday).length > 0 && (
          <>
            <h2 className="font-mono text-[10px] tracking-widest uppercase mt-8 mb-3" style={{ color: "var(--text-3)" }}>
              Previous applications
            </h2>
            <div className="space-y-2">
              {apps
                .filter((a) => a.status === "applied" && new Date(a.session_date) < monday)
                .slice(0, 30)
                .map((a) => (
                  <ApplicationRow key={a.id} app={a} showDate />
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ApplicationRow({ app, showDate }: { app: Application; showDate?: boolean }) {
  const dateLabel = app.applied_at
    ? new Date(app.applied_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : app.session_date;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Left: dot */}
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
        style={{ background: "var(--text-3)" }}
      />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--text-1)" }}>
              {app.job_title ?? `Job #${app.job_id}`}
            </p>
            {app.job_company_name && (
              <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-2)" }}>
                {app.job_company_name}
              </p>
            )}
          </div>

          {/* Right side: status + date + link */}
          <div className="flex items-center gap-2 shrink-0">
            <StatusChip status={app.status} />
            {showDate && (
              <span className="font-mono text-[9px]" style={{ color: "var(--text-3)" }}>
                {dateLabel}
              </span>
            )}
            {app.job_url && (
              <a
                href={app.job_url}
                target="_blank"
                rel="noopener noreferrer"
                title="View original job description"
                className="px-2 py-0.5 rounded-lg font-mono text-[9px] tracking-wider uppercase"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--text-2)",
                  border: "1px solid var(--border)",
                }}
              >
                JD ↗
              </a>
            )}
          </div>
        </div>

        {app.notes && (
          <p className="font-mono text-[9px] mt-1.5 truncate" style={{ color: "var(--text-3)" }}>
            {app.notes}
          </p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-xl px-4 py-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="font-display text-3xl font-bold mb-1" style={{ color: "var(--text-1)" }}>
        {value}
      </p>
      <p className="font-mono text-[9px] tracking-widest uppercase" style={{ color: "var(--text-3)" }}>
        {label}
      </p>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  applied:      "Applied",
  interviewing: "Interview",
  offer:        "Offer",
  rejected:     "Rejected",
  saved:        "Saved",
  skipped:      "Skipped",
  archived:     "Archived",
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className="font-mono text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-lg"
      style={{
        background: "var(--surface-2)",
        color: "var(--text-3)",
        border: "1px solid var(--border)",
      }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

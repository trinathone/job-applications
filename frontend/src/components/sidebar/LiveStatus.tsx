import { useQuery } from "@tanstack/react-query";
import client from "../../api/client";

interface ComponentHealth {
  status: "ok" | "degraded" | "down";
  latency_ms?: number | null;
  detail?: string | null;
}

interface HealthData {
  status: "ok" | "degraded" | "down";
  db: ComponentHealth;
  redis: ComponentHealth;
  celery: ComponentHealth;
  last_scrape_run: string | null;
}

interface ScrapeRun {
  ats: string;
  slug: string;
  started_at: string;
  status: string;
  jobs_found: number;
  jobs_new: number;
  error_kind: string | null;
}

interface ScrapeHealthData {
  runs_last_7d: ScrapeRun[];
  success_rate_7d: number;
  avg_jobs_per_run: number;
  dead_slugs_count: number;
  dormant_slugs_count: number;
}

function StatusDot({ status }: { status: "ok" | "degraded" | "down" }) {
  // monochrome: ok = text-2, degraded = text-3, down = text-1 + pulse
  const bg = status === "ok" ? "var(--text-2)" : status === "degraded" ? "var(--text-3)" : "var(--text-1)";
  return (
    <span
      className={`w-2 h-2 rounded-full inline-block shrink-0 ${status === "down" ? "animate-pulse" : ""}`}
      style={{ background: bg }}
    />
  );
}

function ServiceRow({ label, health }: { label: string; health: ComponentHealth }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={health.status} />
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {health.latency_ms != null && (
          <span style={{ fontSize: 12, color: "var(--text-4)" }}>{health.latency_ms}ms</span>
        )}
        {health.detail && (
          <span
            style={{ fontSize: 12, color: "var(--text-3)", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={health.detail}
          >
            {health.detail}
          </span>
        )}
      </div>
    </div>
  );
}

export default function LiveStatus() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery<HealthData>({
    queryKey: ["health"],
    queryFn: async () => (await client.get("/health")).data,
    refetchInterval: 10_000,
    retry: false,
  });
  const { data: scrapeData } = useQuery<ScrapeHealthData>({
    queryKey: ["scrape-health-public"],
    queryFn: async () => (await client.get("/admin/scrape-health")).data,
    refetchInterval: 30_000,
    retry: false,
  });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  if (isLoading) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: "var(--text-4)", fontFamily: "JetBrains Mono, monospace" }}>
        Checking services…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
        <span className="w-2 h-2 rounded-full animate-pulse inline-block" style={{ background: "var(--text-1)" }} />
        API unreachable
      </div>
    );
  }

  const lastScrape = data.last_scrape_run
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(data.last_scrape_run).getTime()) / 60_000);
        return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
      })()
    : "never";

  const sourceHealth = Object.values((scrapeData?.runs_last_7d ?? []).reduce<Record<string, {
    ats: string;
    total: number;
    ok: number;
    newJobs: number;
    latest: string;
  }>>((acc, run) => {
    const item = acc[run.ats] ?? {
      ats: run.ats,
      total: 0,
      ok: 0,
      newJobs: 0,
      latest: run.started_at,
    };
    item.total += 1;
    if (run.status === "success" || run.status === "ok" || run.status === "ok_empty") item.ok += 1;
    item.newJobs += run.jobs_new;
    if (new Date(run.started_at).getTime() > new Date(item.latest).getTime()) item.latest = run.started_at;
    acc[run.ats] = item;
    return acc;
  }, {})).sort((a, b) => a.ats.localeCompare(b.ats));

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDot status={data.status} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>
            {data.status === "ok" ? "All systems OK" : data.status === "degraded" ? "Degraded" : "Outage"}
          </span>
        </div>
        {lastUpdated && (
          <span style={{ fontSize: 12, color: "var(--text-4)", fontFamily: "JetBrains Mono, monospace" }}>
            {lastUpdated}
          </span>
        )}
      </div>

      <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <ServiceRow label="Database" health={data.db} />
        <ServiceRow label="Redis"    health={data.redis} />
        <ServiceRow label="Celery"   health={data.celery} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
        <span style={{ color: "var(--text-4)", fontFamily: "JetBrains Mono, monospace" }}>Last scrape</span>
        <span style={{ color: "var(--text-3)", fontFamily: "JetBrains Mono, monospace" }}>{lastScrape}</span>
      </div>

      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{
            color: "var(--text-4)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}>
            Job boards
          </span>
          {scrapeData && (
            <span style={{ color: "var(--text-4)", fontFamily: "JetBrains Mono, monospace", fontSize: 10 }}>
              {Math.round(scrapeData.success_rate_7d * 100)}% ok
            </span>
          )}
        </div>

        {sourceHealth.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text-4)" }}>No scrape source data yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sourceHealth.map((source) => {
              const ratio = source.total > 0 ? source.ok / source.total : 0;
              const status: "ok" | "degraded" | "down" = ratio >= 0.75 ? "ok" : ratio > 0 ? "degraded" : "down";
              return (
                <div key={source.ats} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "8px 0",
                  borderTop: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <StatusDot status={status} />
                    <span style={{
                      fontSize: 12,
                      color: "var(--text-2)",
                      textTransform: "capitalize",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {source.ats.replace(/_/g, " ")}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: 10,
                    color: "var(--text-4)",
                    whiteSpace: "nowrap",
                  }}>
                    {source.ok}/{source.total} · +{source.newJobs}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

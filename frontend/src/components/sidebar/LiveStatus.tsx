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
    </div>
  );
}

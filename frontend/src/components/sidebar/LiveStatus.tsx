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
  const colors = { ok: "bg-green-400", degraded: "bg-yellow-400", down: "bg-red-500" };
  return (
    <span className={`w-2 h-2 rounded-full inline-block shrink-0 ${colors[status]} ${status === "down" ? "animate-pulse" : ""}`} />
  );
}

function ServiceRow({ label, health }: { label: string; health: ComponentHealth }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <StatusDot status={health.status} />
        <span className="text-xs text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {health.latency_ms != null && (
          <span className="text-xs text-gray-600">{health.latency_ms}ms</span>
        )}
        {health.detail && (
          <span className="text-xs text-gray-500 truncate max-w-[80px]" title={health.detail}>
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

  if (isLoading) return <div className="p-4 text-xs text-gray-500 animate-pulse">Checking services…</div>;

  if (error || !data) {
    return (
      <div className="p-4 flex items-center gap-2 text-xs text-red-400">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
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
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusDot status={data.status} />
          <span className="text-xs font-medium text-gray-200">
            {data.status === "ok" ? "All systems OK" : data.status === "degraded" ? "Degraded" : "Outage"}
          </span>
        </div>
        {lastUpdated && <span className="text-xs text-gray-600">{lastUpdated}</span>}
      </div>

      <div className="divide-y divide-gray-800">
        <ServiceRow label="Database" health={data.db} />
        <ServiceRow label="Redis" health={data.redis} />
        <ServiceRow label="Celery" health={data.celery} />
      </div>

      <div className="flex justify-between text-xs">
        <span className="text-gray-500">Last scrape</span>
        <span className="text-gray-400">{lastScrape}</span>
      </div>
    </div>
  );
}

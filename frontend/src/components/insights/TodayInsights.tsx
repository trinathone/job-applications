import { useQuery } from "@tanstack/react-query";
import client from "../../api/client";

interface Insights {
  new_jobs_today: number;
  applied_today: number;
  apply_streak_days: number;
  top_ats_sources: Record<string, number>;
  top_companies: string[];
  top_skills: string[];
  scrape_healthy: boolean;
}

export default function TodayInsights() {
  const { data, isLoading } = useQuery<Insights>({
    queryKey: ["insights"],
    queryFn: async () => (await client.get("/dashboard/insights")).data,
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return <div className="p-4 text-gray-500 text-sm">Loading insights…</div>;
  }

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${data.scrape_healthy ? "bg-green-400" : "bg-red-400"}`} />
        <span className="text-xs text-gray-400">
          {data.scrape_healthy ? "Scrape OK" : "Scrape degraded"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="New today" value={data.new_jobs_today} />
        <Stat label="Applied" value={data.applied_today} />
        <Stat label="Streak" value={`${data.apply_streak_days}d`} />
      </div>

      {Object.keys(data.top_ats_sources).length > 0 && (
        <section>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Sources</h3>
          <div className="space-y-1">
            {Object.entries(data.top_ats_sources)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 6)
              .map(([ats, count]) => (
                <div key={ats} className="flex justify-between text-xs">
                  <span className="text-gray-300 capitalize">{ats.replace(/_/g, " ")}</span>
                  <span className="text-gray-500">{count}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      {data.top_companies.length > 0 && (
        <section>
          <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Top Companies</h3>
          <div className="flex flex-wrap gap-1">
            {data.top_companies.map((c) => (
              <span key={c} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{c}</span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-800 rounded-lg px-3 py-2">
      <p className="text-lg font-bold text-gray-100">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

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
    return (
      <div style={{ padding: 16, fontSize: 12, color: "var(--text-4)", fontFamily: "JetBrains Mono, monospace" }}>
        Loading insights…
      </div>
    );
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: "50%",
            background: data.scrape_healthy ? "var(--text-2)" : "var(--text-1)",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          {data.scrape_healthy ? "Scrape OK" : "Scrape degraded"}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Stat label="New today" value={data.new_jobs_today} />
        <Stat label="Applied"   value={data.applied_today} />
        <Stat label="Streak"    value={`${data.apply_streak_days}d`} />
      </div>

      {Object.keys(data.top_ats_sources).length > 0 && (
        <section>
          <h3 style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--text-4)", marginBottom: 8,
          }}>
            Sources
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {Object.entries(data.top_ats_sources)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 6)
              .map(([ats, count]) => (
                <div key={ats} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "var(--text-2)", textTransform: "capitalize" }}>
                    {ats.replace(/_/g, " ")}
                  </span>
                  <span style={{ color: "var(--text-4)", fontFamily: "JetBrains Mono, monospace" }}>
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {data.top_companies.length > 0 && (
        <section>
          <h3 style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--text-4)", marginBottom: 8,
          }}>
            Top Companies
          </h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {data.top_companies.map((c) => (
              <span key={c} style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 4,
                background: "var(--surface-2)", color: "var(--text-3)",
                border: "1px solid var(--border)",
              }}>
                {c}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      background: "var(--surface-2)", borderRadius: 8,
      padding: "8px 12px", border: "1px solid var(--border)",
    }}>
      <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 2 }}>{value}</p>
      <p style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 9, letterSpacing: "0.07em", textTransform: "uppercase",
        color: "var(--text-4)",
      }}>
        {label}
      </p>
    </div>
  );
}

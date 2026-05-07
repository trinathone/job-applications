import { useCallback, useEffect, useRef, useState } from "react";
import {
  useFilterStore, countActiveFilters,
  type SortBy, type DateFilter, type RemoteFilter,
  type JobTypeFilter, type CountryFilter,
} from "../../store/filterStore";

function fmt(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`;
  return `${Math.floor(n / 1000)}k`;
}

export default function FilterBar({ total, showing }: { total: number; showing: number }) {
  const filters = useFilterStore();
  const set     = useFilterStore((s) => s.set);
  const reset   = useFilterStore((s) => s.reset);
  const active  = countActiveFilters(filters);
  const [expanded, setExpanded] = useState(false);

  /* Debounced search */
  const [localSearch, setLocalSearch] = useState(filters.company);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { setLocalSearch(filters.company); }, [filters.company]);
  const handleSearch = useCallback((val: string) => {
    setLocalSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => set({ company: val }), 280);
  }, [set]);

  const secondaryActive = [
    filters.remote !== "all", filters.salaryMin > 0,
    filters.yoeMax !== null, filters.ats !== "", !filters.hideApplied,
  ].filter(Boolean).length;

  return (
    <div style={{ flexShrink: 0, borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>

      {/* Primary row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", flexWrap: "nowrap", overflowX: "auto" }}>

        {/* Count */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 3, flexShrink: 0 }}>
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, fontWeight: 600, color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
            {showing < total ? fmt(showing) : fmt(total)}
          </span>
          {showing < total && (
            <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-4)" }}>
              /{fmt(total)}
            </span>
          )}
          <span style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-4)" }}>
            showing
          </span>
        </div>

        <Div />

        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 0", minWidth: 0, maxWidth: 210 }}>
          <svg style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="var(--text-4)" strokeWidth="2">
            <circle cx="6.5" cy="6.5" r="5"/><path d="m11 11 3.5 3.5" strokeLinecap="round"/>
          </svg>
          <input
            type="text" placeholder="Search title or company…"
            value={localSearch} onChange={e => handleSearch(e.target.value)}
            style={{
              width: "100%", paddingLeft: 24, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
              borderRadius: 6, fontSize: 11,
              fontFamily: "Inter, system-ui, sans-serif",
              background: localSearch.trim() ? "var(--surface-2)" : "rgba(255,255,255,0.02)",
              border: localSearch.trim() ? "1px solid var(--border-2)" : "1px solid var(--border)",
              color: "var(--text-1)",
              outline: "none",
            }}
          />
        </div>

        <Div />

        <FSelect label="Sort" value={filters.sortBy} active={filters.sortBy !== "date"}
          onChange={v => set({ sortBy: v as SortBy })}
          options={[
            { v: "date", l: "Newest" }, { v: "salary", l: "Salary" },
            { v: "distance", l: "Near PA" }, { v: "yoe", l: "Entry" }, { v: "match", l: "Match" },
          ]}
        />

        <FSelect label="Posted" value={filters.datePosted} active={filters.datePosted !== "all"}
          onChange={v => set({ datePosted: v as DateFilter })}
          options={[
            { v: "all", l: "Any time" }, { v: "1h", l: "1h" }, { v: "5h", l: "5h" },
            { v: "12h", l: "12h" }, { v: "24h", l: "Today" },
            { v: "3d", l: "3d" }, { v: "7d", l: "Week" }, { v: "30d", l: "Month" },
          ]}
        />

        <FSelect label="Type" value={filters.jobType} active={filters.jobType !== "all"}
          onChange={v => set({ jobType: v as JobTypeFilter })}
          options={[
            { v: "all", l: "All" }, { v: "full_time", l: "Full-time" },
            { v: "part_time", l: "Part-time" }, { v: "contract", l: "Contract" },
          ]}
        />

        <Div />

        {/* Country pills */}
        <div style={{ display: "flex", flexShrink: 0, borderRadius: 6, border: "1px solid var(--border)", overflow: "hidden" }}>
          {(["usa", "india", "all"] as CountryFilter[]).map((v, i) => {
            const active = filters.country === v;
            const labels: Record<CountryFilter, string> = { usa: "USA", india: "IND", all: "ALL" };
            return (
              <button key={v} onClick={() => set({ country: v })} style={{
                padding: "3px 9px",
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 9, fontWeight: 600,
                letterSpacing: "0.08em", textTransform: "uppercase",
                background: active ? "var(--text-1)" : "transparent",
                color: active ? "var(--bg)" : "var(--text-4)",
                border: "none",
                borderRight: i < 2 ? "1px solid var(--border)" : "none",
                transition: "background 0.1s, color 0.1s",
              }}>
                {labels[v]}
              </button>
            );
          })}
        </div>

        <Div />

        {/* 80%+ match */}
        <button
          onClick={() => set({ mustApply: !filters.mustApply })}
          style={{
            flexShrink: 0, padding: "4px 9px", borderRadius: 5,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 9, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase",
            background: filters.mustApply ? "var(--text-1)" : "transparent",
            color: filters.mustApply ? "var(--bg)" : "var(--text-4)",
            border: "1px solid var(--border)",
            transition: "all 0.12s",
          }}
        >
          80%+
        </button>

        {/* More ▾ */}
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            flexShrink: 0, padding: "4px 9px", borderRadius: 5,
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 9, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase",
            background: (expanded || secondaryActive > 0) ? "var(--surface-3)" : "transparent",
            color: (expanded || secondaryActive > 0) ? "var(--text-2)" : "var(--text-4)",
            border: "1px solid var(--border)",
          }}
        >
          {secondaryActive > 0 ? `+${secondaryActive}` : "More"}
        </button>

        {/* Clear */}
        {active > 0 && (
          <>
            <Div />
            <button
              onClick={reset}
              style={{
                flexShrink: 0, padding: "4px 9px", borderRadius: 5,
                fontFamily: "JetBrains Mono, monospace",
                fontSize: 9, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase",
                background: "transparent", color: "var(--text-3)",
                border: "1px solid var(--border)",
              }}
            >
              ✕ {active}
            </button>
          </>
        )}
      </div>

      {/* Secondary row */}
      {expanded && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 12px",
          flexWrap: "wrap", borderTop: "1px solid var(--border)",
          background: "rgba(255,255,255,0.01)",
        }}>
          <FSelect label="Work" value={filters.remote} active={filters.remote !== "all"}
            onChange={v => set({ remote: v as RemoteFilter })}
            options={[{ v: "all", l: "Any" }, { v: "remote", l: "Remote" }, { v: "onsite", l: "On-site" }]}
          />
          <Div />
          <FSelect label="Pay" value={String(filters.salaryMin)} active={filters.salaryMin > 0}
            onChange={v => set({ salaryMin: Number(v) })}
            options={[
              { v: "0", l: "Any" }, { v: "50000", l: "$50k+" }, { v: "75000", l: "$75k+" },
              { v: "100000", l: "$100k+" }, { v: "130000", l: "$130k+" },
              { v: "150000", l: "$150k+" }, { v: "200000", l: "$200k+" },
            ]}
          />
          <FSelect label="Exp" value={filters.yoeMax == null ? "" : String(filters.yoeMax)} active={filters.yoeMax !== null}
            onChange={v => set({ yoeMax: v === "" ? null : Number(v) })}
            options={[
              { v: "", l: "Any" }, { v: "1", l: "0–1 yr" }, { v: "2", l: "0–2 yr" },
              { v: "5", l: "0–5 yr" }, { v: "8", l: "0–8 yr" }, { v: "12", l: "0–12 yr" },
            ]}
          />
          <FSelect label="Via" value={filters.ats} active={filters.ats !== ""}
            onChange={v => set({ ats: v })}
            options={[
              { v: "", l: "All" }, { v: "greenhouse", l: "Greenhouse" },
              { v: "lever", l: "Lever" }, { v: "ashby", l: "Ashby" },
              { v: "linkedin", l: "LinkedIn" }, { v: "serpapi", l: "Google" },
              { v: "theirstack", l: "TheirStack" }, { v: "hn_hiring", l: "HN Hiring" },
              { v: "remotive", l: "Remotive" },
            ]}
          />
          <Div />
          <Toggle label="Hide applied" checked={filters.hideApplied} onChange={v => set({ hideApplied: v })} />
        </div>
      )}
    </div>
  );
}

function Div() {
  return <div style={{ width: 1, height: 14, flexShrink: 0, background: "var(--border)" }} />;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, whiteSpace: "nowrap" }}>
      <span
        onClick={() => onChange(!checked)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 14, height: 14, borderRadius: 4, flexShrink: 0,
          background: checked ? "var(--text-1)" : "transparent",
          border: checked ? "1px solid var(--text-1)" : "1px solid var(--border-2)",
          transition: "all 0.12s",
        }}
      >
        {checked && <span style={{ color: "var(--bg)", fontSize: 9, lineHeight: 1 }}>✓</span>}
      </span>
      <span style={{
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 9, letterSpacing: "0.07em", textTransform: "uppercase",
        color: checked ? "var(--text-1)" : "var(--text-4)",
      }}>
        {label}
      </span>
    </label>
  );
}

function FSelect({ label, value, onChange, options, active }: {
  label: string; value: string; active: boolean;
  onChange(v: string): void; options: { v: string; l: string }[];
}) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, whiteSpace: "nowrap" }}>
      <span style={{
        fontFamily: "JetBrains Mono, monospace", fontSize: 9,
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: active ? "var(--text-2)" : "var(--text-4)",
      }}>
        {label}
      </span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        fontFamily: "Inter, system-ui, sans-serif", fontSize: 11,
        padding: "3px 6px", borderRadius: 5, outline: "none",
        background: active ? "var(--surface-2)" : "rgba(255,255,255,0.02)",
        border: active ? "1px solid var(--border-2)" : "1px solid var(--border)",
        color: active ? "var(--text-1)" : "var(--text-2)",
        transition: "all 0.1s",
      }}>
        {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

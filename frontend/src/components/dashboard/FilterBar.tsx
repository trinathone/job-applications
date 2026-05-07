import { useFilterStore, countActiveFilters, type SortBy, type DateFilter, type RemoteFilter } from "../../store/filterStore";

export default function FilterBar({ total, showing }: { total: number; showing: number }) {
  const filters = useFilterStore();
  const set = useFilterStore((s) => s.set);
  const reset = useFilterStore((s) => s.reset);
  const active = countActiveFilters(filters);

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-950 overflow-x-auto scrollbar-thin shrink-0">
      {/* Result count */}
      <span className="text-xs text-gray-500 whitespace-nowrap shrink-0 mr-1">
        {showing < total ? (
          <><span className="text-gray-200 font-medium">{showing}</span> of {total}</>
        ) : (
          <span className="text-gray-200 font-medium">{total}</span>
        )}{" "}
        jobs
      </span>

      <div className="w-px h-4 bg-gray-700 shrink-0" />

      {/* Sort */}
      <FilterSelect
        label="Sort"
        value={filters.sortBy}
        onChange={(v) => set({ sortBy: v as SortBy })}
        active={filters.sortBy !== "date"}
        options={[
          { value: "date", label: "Newest first" },
          { value: "salary", label: "Salary ↓" },
          { value: "distance", label: "Near PA" },
          { value: "yoe", label: "Entry level first" },
          { value: "match", label: "Match score ↓" },
        ]}
      />

      <div className="w-px h-4 bg-gray-700 shrink-0" />

      {/* Date posted */}
      <FilterSelect
        label="Posted"
        value={filters.datePosted}
        onChange={(v) => set({ datePosted: v as DateFilter })}
        active={filters.datePosted !== "all"}
        options={[
          { value: "all", label: "Anytime" },
          { value: "1h", label: "Last 1 hour" },
          { value: "5h", label: "Last 5 hours" },
          { value: "12h", label: "Last 12 hours" },
          { value: "24h", label: "Today (24h)" },
          { value: "3d", label: "Last 3 days" },
          { value: "7d", label: "Last week" },
          { value: "30d", label: "Last month" },
        ]}
      />

      {/* Remote */}
      <FilterSelect
        label="Work"
        value={filters.remote}
        onChange={(v) => set({ remote: v as RemoteFilter })}
        active={filters.remote !== "all"}
        options={[
          { value: "all", label: "Any" },
          { value: "remote", label: "Remote only" },
          { value: "onsite", label: "On-site only" },
        ]}
      />

      {/* Salary */}
      <FilterSelect
        label="Salary"
        value={String(filters.salaryMin)}
        onChange={(v) => set({ salaryMin: Number(v) })}
        active={filters.salaryMin > 0}
        options={[
          { value: "0", label: "Any" },
          { value: "50000", label: "$50k+" },
          { value: "75000", label: "$75k+" },
          { value: "100000", label: "$100k+" },
          { value: "130000", label: "$130k+" },
          { value: "150000", label: "$150k+" },
          { value: "200000", label: "$200k+" },
        ]}
      />

      {/* Experience */}
      <FilterSelect
        label="Exp"
        value={filters.yoeMax == null ? "" : String(filters.yoeMax)}
        onChange={(v) => set({ yoeMax: v === "" ? null : Number(v) })}
        active={filters.yoeMax !== null}
        options={[
          { value: "", label: "Any level" },
          { value: "1", label: "0–1 yr (New grad)" },
          { value: "2", label: "0–2 yrs (Junior)" },
          { value: "5", label: "0–5 yrs (Mid)" },
          { value: "8", label: "0–8 yrs (Senior)" },
          { value: "12", label: "0–12 yrs (Staff)" },
        ]}
      />

      {/* Source */}
      <FilterSelect
        label="Source"
        value={filters.ats}
        onChange={(v) => set({ ats: v })}
        active={filters.ats !== ""}
        options={[
          { value: "", label: "All" },
          { value: "greenhouse", label: "Greenhouse" },
          { value: "lever", label: "Lever" },
          { value: "ashby", label: "Ashby" },
          { value: "linkedin", label: "LinkedIn" },
          { value: "serpapi", label: "Google Jobs" },
          { value: "theirstack", label: "TheirStack" },
          { value: "hn_hiring", label: "HN Hiring" },
          { value: "remotive", label: "Remotive" },
        ]}
      />

      <div className="w-px h-4 bg-gray-700 shrink-0" />

      {/* USA only toggle */}
      <label className="flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.usaOnly}
          onChange={(e) => set({ usaOnly: e.target.checked })}
          className="w-3 h-3 accent-blue-500"
        />
        <span className={`text-xs font-medium ${filters.usaOnly ? "text-blue-400" : "text-gray-500"}`}>
          USA only
        </span>
      </label>

      <div className="w-px h-4 bg-gray-700 shrink-0" />

      {/* Must Apply toggle */}
      <button
        onClick={() => set({ mustApply: !filters.mustApply })}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap shrink-0 ${
          filters.mustApply
            ? "bg-green-500/20 text-green-400 border-green-500/50"
            : "bg-gray-900 text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300"
        }`}
        title="Show only jobs where your resume matches 80%+ of the keywords"
      >
        {filters.mustApply && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />}
        Must Apply
      </button>

      <div className="w-px h-4 bg-gray-700 shrink-0" />

      {/* Hide Applied toggle */}
      <label className="flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer">
        <input
          type="checkbox"
          checked={filters.hideApplied}
          onChange={(e) => set({ hideApplied: e.target.checked })}
          className="w-3 h-3 accent-blue-500"
        />
        <span className={`text-xs font-medium ${filters.hideApplied ? "text-blue-400" : "text-gray-500"}`}>
          Hide applied
        </span>
      </label>

      <div className="w-px h-4 bg-gray-700 shrink-0" />

      {/* Company / title keyword search */}
      <input
        type="text"
        placeholder="Company or title…"
        value={filters.company}
        onChange={(e) => set({ company: e.target.value })}
        className={`text-xs rounded px-2 py-1 bg-gray-900 border focus:outline-none w-40 shrink-0 ${
          filters.company.trim()
            ? "border-blue-500 text-blue-200 placeholder-blue-400"
            : "border-gray-700 text-gray-200 placeholder-gray-600 hover:border-gray-600"
        }`}
      />

      {/* Reset badge */}
      {active > 0 && (
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-white whitespace-nowrap shrink-0 ml-1 transition-colors"
        >
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-bold">
            {active}
          </span>
          Clear
        </button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  active = false,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
  options: { value: string; label: string }[];
  active?: boolean;
}) {
  return (
    <label className="flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer">
      <span className={`text-xs font-medium ${active ? "text-blue-400" : "text-gray-500"}`}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`text-xs rounded px-1.5 py-1 bg-gray-900 border focus:outline-none cursor-pointer transition-colors ${
          active
            ? "border-blue-500 text-blue-300"
            : "border-gray-700 text-gray-300 hover:border-gray-600"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

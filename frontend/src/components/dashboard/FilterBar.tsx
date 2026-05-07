import { useFilterStore, countActiveFilters, type SortBy, type DateFilter, type RemoteFilter } from "../../store/filterStore";

export default function FilterBar({ total, showing }: { total: number; showing: number }) {
  const filters = useFilterStore();
  const set     = useFilterStore((s) => s.set);
  const reset   = useFilterStore((s) => s.reset);
  const active  = countActiveFilters(filters);

  return (
    <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto scrollbar-thin shrink-0"
      style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", background:"rgba(7,9,16,0.95)" }}>

      {/* Count badge */}
      <div className="flex items-center gap-1.5 shrink-0 mr-1">
        <span className="text-xs font-semibold" style={{color:"#e2e8f0"}}>
          {showing < total ? showing : total}
        </span>
        {showing < total && <span className="text-xs" style={{color:"rgba(148,163,184,0.4)"}}>of {total}</span>}
        <span className="text-xs" style={{color:"rgba(148,163,184,0.4)"}}>jobs</span>
      </div>

      <Div />

      {/* Sort */}
      <FSelect label="Sort" value={filters.sortBy} active={filters.sortBy!=="date"}
        onChange={v=>set({sortBy:v as SortBy})} options={[
          {v:"date",l:"Newest first"},{v:"salary",l:"Salary ↓"},
          {v:"distance",l:"Near PA"},{v:"yoe",l:"Entry level"},{v:"match",l:"Match %"},
        ]}/>

      <Div />

      {/* Posted */}
      <FSelect label="Posted" value={filters.datePosted} active={filters.datePosted!=="all"}
        onChange={v=>set({datePosted:v as DateFilter})} options={[
          {v:"all",l:"Anytime"},{v:"1h",l:"Last 1 hour"},{v:"5h",l:"Last 5 hours"},
          {v:"12h",l:"Last 12 hours"},{v:"24h",l:"Today (24h)"},
          {v:"3d",l:"Last 3 days"},{v:"7d",l:"Last week"},{v:"30d",l:"Last month"},
        ]}/>

      {/* Remote */}
      <FSelect label="Work" value={filters.remote} active={filters.remote!=="all"}
        onChange={v=>set({remote:v as RemoteFilter})} options={[
          {v:"all",l:"Any"},{v:"remote",l:"Remote only"},{v:"onsite",l:"On-site only"},
        ]}/>

      {/* Salary */}
      <FSelect label="Salary" value={String(filters.salaryMin)} active={filters.salaryMin>0}
        onChange={v=>set({salaryMin:Number(v)})} options={[
          {v:"0",l:"Any"},{v:"50000",l:"$50k+"},{v:"75000",l:"$75k+"},
          {v:"100000",l:"$100k+"},{v:"130000",l:"$130k+"},{v:"150000",l:"$150k+"},{v:"200000",l:"$200k+"},
        ]}/>

      {/* Experience */}
      <FSelect label="Exp" value={filters.yoeMax==null?"":String(filters.yoeMax)} active={filters.yoeMax!==null}
        onChange={v=>set({yoeMax:v===""?null:Number(v)})} options={[
          {v:"",l:"Any level"},{v:"1",l:"0–1 yr"},{v:"2",l:"0–2 yrs"},
          {v:"5",l:"0–5 yrs"},{v:"8",l:"0–8 yrs"},{v:"12",l:"0–12 yrs"},
        ]}/>

      {/* Source */}
      <FSelect label="Source" value={filters.ats} active={filters.ats!==""}
        onChange={v=>set({ats:v})} options={[
          {v:"",l:"All"},{v:"greenhouse",l:"Greenhouse"},{v:"lever",l:"Lever"},
          {v:"ashby",l:"Ashby"},{v:"linkedin",l:"LinkedIn"},
          {v:"serpapi",l:"Google Jobs"},{v:"theirstack",l:"TheirStack"},
          {v:"hn_hiring",l:"HN Hiring"},{v:"remotive",l:"Remotive"},
        ]}/>

      <Div />

      {/* USA only */}
      <Toggle label="USA only" checked={filters.usaOnly} onChange={v=>set({usaOnly:v})} />

      <Div />

      {/* Must Apply */}
      <button onClick={()=>set({mustApply:!filters.mustApply})}
        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all duration-200"
        style={filters.mustApply ? {
          background:"rgba(34,197,94,0.12)",color:"#4ade80",border:"1px solid rgba(34,197,94,0.3)",
          boxShadow:"0 0 12px rgba(34,197,94,0.15)"
        } : {
          background:"rgba(255,255,255,0.04)",color:"rgba(148,163,184,0.5)",border:"1px solid rgba(255,255,255,0.06)",
        }}>
        {filters.mustApply && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>}
        Must Apply
      </button>

      <Div />

      {/* Hide applied */}
      <Toggle label="Hide applied" checked={filters.hideApplied} onChange={v=>set({hideApplied:v})} />

      <Div />

      {/* Search */}
      <input type="text" placeholder="Company or title…" value={filters.company}
        onChange={e=>set({company:e.target.value})}
        className="text-xs rounded-lg px-3 py-1 w-40 shrink-0 outline-none transition-all duration-200"
        style={{
          background:"rgba(255,255,255,0.04)",
          border:filters.company.trim()?"1px solid rgba(99,102,241,0.5)":"1px solid rgba(255,255,255,0.06)",
          color:filters.company.trim()?"#a5b4fc":"#e2e8f0",
        }}/>

      {/* Reset */}
      {active > 0 && (
        <button onClick={reset}
          className="flex items-center gap-1.5 text-xs font-semibold shrink-0 ml-1 px-2.5 py-1 rounded-lg transition-all duration-200"
          style={{background:"rgba(239,68,68,0.08)",color:"#f87171",border:"1px solid rgba(239,68,68,0.15)"}}>
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold"
            style={{background:"rgba(239,68,68,0.3)"}}>
            {active}
          </span>
          Clear
        </button>
      )}
    </div>
  );
}

function Div() {
  return <div className="w-px h-4 shrink-0" style={{background:"rgba(255,255,255,0.08)"}}/>;
}

function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(v:boolean)=>void}) {
  return (
    <label className="flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}
        className="w-3 h-3 accent-blue-500"/>
      <span className="text-xs font-medium" style={{color:checked?"#60a5fa":"rgba(148,163,184,0.5)"}}>
        {label}
      </span>
    </label>
  );
}

function FSelect({label,value,onChange,options,active}:{
  label:string;value:string;active:boolean;
  onChange:(v:string)=>void;options:{v:string;l:string}[];
}) {
  return (
    <label className="flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer">
      <span className="text-xs font-medium" style={{color:active?"#60a5fa":"rgba(148,163,184,0.45)"}}>
        {label}
      </span>
      <select value={value} onChange={e=>onChange(e.target.value)}
        className="text-xs rounded-lg px-2 py-1 outline-none cursor-pointer transition-all duration-200"
        style={{
          background:"rgba(255,255,255,0.04)",
          border:active?"1px solid rgba(99,102,241,0.4)":"1px solid rgba(255,255,255,0.06)",
          color:active?"#a5b4fc":"#94a3b8",
        }}>
        {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </label>
  );
}

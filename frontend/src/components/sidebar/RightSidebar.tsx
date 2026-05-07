import { useState } from "react";
import TodayInsights from "../insights/TodayInsights";
import LiveStatus from "./LiveStatus";
import ApiKeyManager from "./ApiKeyManager";

type Tab = "today" | "status" | "apis";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "today",  label: "Today",  icon: "✦" },
  { id: "status", label: "Status", icon: "◉" },
  { id: "apis",   label: "APIs",   icon: "⚙" },
];

export default function RightSidebar() {
  const [tab, setTab] = useState<Tab>("today");
  return (
    <div className="flex flex-col h-full" style={{background:"#070910"}}>
      <div className="flex shrink-0" style={{borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className="flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[9px] font-semibold tracking-wider uppercase transition-all duration-200"
            style={tab===t.id?{
              color:"#60a5fa",
              borderBottom:"2px solid #3b82f6",
              background:"rgba(59,130,246,0.04)",
            }:{
              color:"rgba(148,163,184,0.35)",
              borderBottom:"2px solid transparent",
            }}>
            <span className="text-sm leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tab==="today"  && <TodayInsights/>}
        {tab==="status" && <LiveStatus/>}
        {tab==="apis"   && <ApiKeyManager/>}
      </div>
    </div>
  );
}

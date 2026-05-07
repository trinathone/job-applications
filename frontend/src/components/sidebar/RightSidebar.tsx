import { useState } from "react";
import TodayInsights from "../insights/TodayInsights";
import LiveStatus from "./LiveStatus";
import ApiKeyManager from "./ApiKeyManager";

type Tab = "today" | "status" | "apis";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "status", label: "Status" },
  { id: "apis", label: "APIs" },
];

export default function RightSidebar() {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab === t.id
                ? "text-blue-400 border-b-2 border-blue-400 -mb-px"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tab === "today" && <TodayInsights />}
        {tab === "status" && <LiveStatus />}
        {tab === "apis" && <ApiKeyManager />}
      </div>
    </div>
  );
}

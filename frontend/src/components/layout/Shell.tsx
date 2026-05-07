import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";

const NAV = [
  { to: "/dashboard",      icon: "⚡", label: "Board" },
  { to: "/resume",         icon: "📄", label: "Resume" },
  { to: "/resume/builder", icon: "✏️",  label: "Build" },
  { to: "/dashboard/week", icon: "📊", label: "Week" },
  { to: "/admin",          icon: "👥", label: "Admin" },
];

export default function Shell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#070910" }}>

      {/* ── Desktop sidebar (hidden on mobile) ── */}
      <nav className="hidden sm:flex w-16 flex-col items-center py-5 gap-1 shrink-0 relative"
        style={{ background: "#0a0c16", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="mb-5">
          <span className="text-xl font-black tracking-tighter"
            style={{
              background: "linear-gradient(135deg,#60a5fa,#a78bfa)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>JA</span>
        </div>
        <div className="flex flex-col gap-1 w-full px-2">
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end={to === "/dashboard"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center h-12 rounded-xl text-[9px] font-semibold tracking-wide transition-all duration-200 gap-0.5 ${
                  isActive ? "text-white" : "text-gray-600 hover:text-gray-300"
                }`
              }
              style={({ isActive }) => isActive ? {
                background: "linear-gradient(135deg,rgba(37,99,235,0.2),rgba(124,58,237,0.2))",
                border: "1px solid rgba(99,102,241,0.2)",
              } : { background: "transparent", border: "1px solid transparent" }}
              title={label}>
              <span className="text-base leading-none">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
        <div className="absolute bottom-0 left-2 right-2 h-[1px]"
          style={{ background: "linear-gradient(90deg,transparent,rgba(99,102,241,0.25),transparent)" }}/>
      </nav>

      {/* ── Mobile top bar ── */}
      <div className="sm:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(10,12,22,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="text-lg font-black tracking-tighter"
          style={{ background: "linear-gradient(135deg,#60a5fa,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          JA
        </span>
        <button onClick={() => setMobileNavOpen(o => !o)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {mobileNavOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* ── Mobile nav drawer ── */}
      {mobileNavOpen && (
        <div className="sm:hidden fixed inset-0 z-40" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute top-14 left-0 right-0 py-2 px-3 flex flex-wrap gap-2"
            onClick={e => e.stopPropagation()}
            style={{ background: "rgba(10,12,22,0.98)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {NAV.map(({ to, icon, label }) => (
              <NavLink key={to} to={to} end={to === "/dashboard"}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium flex-1 min-w-[120px] justify-center transition-all ${
                    isActive ? "text-white" : "text-gray-500"
                  }`
                }
                style={({ isActive }) => isActive ? {
                  background: "linear-gradient(135deg,rgba(37,99,235,0.25),rgba(124,58,237,0.25))",
                  border: "1px solid rgba(99,102,241,0.25)",
                } : { border: "1px solid rgba(255,255,255,0.05)" }}>
                {icon} {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex-1 overflow-hidden sm:pt-0 pt-14">
        <Outlet />
      </main>
    </div>
  );
}

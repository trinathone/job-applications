import { Outlet, NavLink } from "react-router-dom";

const NAV = [
  { to: "/dashboard",      icon: "⚡", label: "Dashboard" },
  { to: "/resume",         icon: "📄", label: "Resume" },
  { to: "/resume/builder", icon: "✏️",  label: "Builder" },
  { to: "/dashboard/week", icon: "📊", label: "Weekly" },
  { to: "/admin",          icon: "👥", label: "Admin" },
];

export default function Shell() {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#070910" }}>
      {/* Sidebar */}
      <nav className="w-16 flex flex-col items-center py-5 gap-1 shrink-0 relative"
        style={{ background: "#0a0c16", borderRight: "1px solid rgba(255,255,255,0.05)" }}>

        {/* Logo */}
        <div className="mb-6 flex flex-col items-center">
          <span className="text-xl font-black tracking-tighter leading-none"
            style={{
              background: "linear-gradient(135deg,#60a5fa,#a78bfa)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>JA</span>
        </div>

        {/* Nav links */}
        <div className="flex flex-col gap-1 w-full px-2">
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} end={to === "/dashboard"}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center h-12 rounded-xl text-xs transition-all duration-200 gap-0.5 ${
                  isActive
                    ? "text-white"
                    : "text-gray-600 hover:text-gray-300"
                }`
              }
              style={({ isActive }) => isActive ? {
                background: "linear-gradient(135deg,rgba(37,99,235,0.25),rgba(124,58,237,0.25))",
                border: "1px solid rgba(99,102,241,0.25)",
                boxShadow: "0 0 16px rgba(99,102,241,0.1)",
              } : {
                background: "transparent",
                border: "1px solid transparent",
              }}
              title={label}>
              <span className="text-base leading-none">{icon}</span>
              <span className="text-[9px] font-medium tracking-wide">{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Bottom glow line */}
        <div className="absolute bottom-0 left-2 right-2 h-[1px]"
          style={{ background: "linear-gradient(90deg,transparent,rgba(99,102,241,0.3),transparent)" }} />
      </nav>

      {/* Main */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

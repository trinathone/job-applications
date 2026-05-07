import { Outlet, NavLink } from "react-router-dom";

export default function Shell() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {/* Sidebar nav */}
      <nav className="w-14 flex flex-col items-center py-4 gap-4 bg-gray-900 border-r border-gray-800 shrink-0">
        <span className="text-blue-400 font-bold text-lg font-mono">JA</span>
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`
          }
          title="Dashboard"
        >
          ⚡
        </NavLink>
        <NavLink
          to="/resume"
          className={({ isActive }) =>
            `w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`
          }
          title="Resume"
        >
          📄
        </NavLink>
        <NavLink
          to="/resume/builder"
          className={({ isActive }) =>
            `w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`
          }
          title="Resume Builder"
        >
          ✏️
        </NavLink>
        <NavLink
          to="/dashboard/week"
          className={({ isActive }) =>
            `w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`
          }
          title="Weekly Review"
        >
          📊
        </NavLink>
        <NavLink
          to="/admin"
          className={({ isActive }) =>
            `w-9 h-9 rounded-lg flex items-center justify-center text-sm font-medium transition-colors ${
              isActive
                ? "bg-blue-600 text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`
          }
          title="Admin — Users"
        >
          👥
        </NavLink>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

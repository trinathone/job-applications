import { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";
import { useThemeStore } from "../../store/themeStore";
import { useViewMode } from "../../context/ViewModeContext";

const BASE_NAV = [
  { to: "/dashboard",      label: "Board" },
  { to: "/resume",         label: "Resume" },
  { to: "/resume/builder", label: "Build" },
  { to: "/dashboard/week", label: "Week" },
];

/* ── Icons ─────────────────────────────────────────────────────────── */
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2"  x2="12" y2="5"  />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2"  y1="12" x2="5"  y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
      <line x1="4.22"  y1="4.22"  x2="6.34"  y2="6.34"  />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="19.78" y1="4.22"  x2="17.66" y2="6.34"  />
      <line x1="6.34"  y1="17.66" x2="4.22"  y2="19.78" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>
    </svg>
  );
}

/* ── Shared icon button style ───────────────────────────────────────── */
function IconBtn({
  onClick, title, active, children,
}: {
  onClick(): void; title: string; active?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: 7, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? "var(--surface-3)" : "var(--surface-2)",
        border: active ? "1px solid var(--border-2)" : "1px solid var(--border)",
        color: active ? "var(--text-2)" : "var(--text-3)",
        transition: "all 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.color = "var(--text-1)")}
      onMouseLeave={e => (e.currentTarget.style.color = active ? "var(--text-2)" : "var(--text-3)")}
    >
      {children}
    </button>
  );
}

/* ── Shell ─────────────────────────────────────────────────────────── */
export default function Shell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAdmin            = useAuthStore((s) => s.isAdmin());
  const { theme, toggle }  = useThemeStore();
  const { mode, isMobile, physicallyMobile, switchTo } = useViewMode();

  const NAV = isAdmin
    ? [...BASE_NAV, { to: "/admin", label: "Admin" }]
    : BASE_NAV;

  const isPhoneMode   = mode === "phone";
  const isDesktopMode = mode === "desktop";

  function handleViewToggle() {
    switchTo(physicallyMobile
      ? (isDesktopMode ? "auto" : "desktop")
      : (isPhoneMode   ? "auto" : "phone")
    );
  }

  const viewIcon  = physicallyMobile
    ? (isDesktopMode ? <PhoneIcon />   : <MonitorIcon />)
    : (isPhoneMode   ? <MonitorIcon /> : <PhoneIcon />);
  const viewTitle = physicallyMobile
    ? (isDesktopMode ? "Switch to mobile view"  : "Switch to desktop view")
    : (isPhoneMode   ? "Switch to desktop view" : "Switch to phone view");

  const showDesktopSidebar = !isMobile;
  const showMobileTopBar   = isMobile;

  return (
    <div style={{ display: "flex", height: "100svh", overflow: "hidden", background: "var(--bg)" }}>

      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      {showDesktopSidebar && (
        <nav style={{
          width: 62, flexShrink: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "20px 0",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}>
          {/* Logo */}
          <div style={{ marginBottom: 28, textAlign: "center" }}>
            <span style={{
              fontFamily: "Syne, sans-serif",
              fontSize: 20, fontWeight: 800,
              color: "var(--text-1)", letterSpacing: "-0.02em",
              lineHeight: 1, display: "block",
            }}>
              JA
            </span>
            <span style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 7, letterSpacing: "0.22em",
              textTransform: "uppercase", color: "var(--text-4)",
              display: "block", marginTop: 3,
            }}>
              jobs
            </span>
          </div>

          <div style={{ width: 24, height: 1, background: "var(--border)", marginBottom: 20 }} />

          {/* Nav links */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", padding: "0 8px" }}>
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to} to={to} end={to === "/dashboard"} title={label}
                style={({ isActive }) => ({
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  padding: "10px 0", borderRadius: 8, gap: 5,
                  textDecoration: "none",
                  background: isActive ? "var(--accent-bg)" : "transparent",
                  border: isActive ? "1px solid var(--border-2)" : "1px solid transparent",
                  color: isActive ? "var(--text-1)" : "var(--text-4)",
                  transition: "all 0.15s",
                })}
              >
                {({ isActive }) => (
                  <>
                    <span style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: isActive ? "var(--text-1)" : "var(--text-4)",
                      transition: "background 0.15s",
                    }} />
                    <span style={{
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: 8, fontWeight: 600,
                      letterSpacing: "0.12em", textTransform: "uppercase",
                      color: "inherit",
                    }}>
                      {label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Bottom controls: view + theme toggles above version */}
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <IconBtn onClick={handleViewToggle} title={viewTitle} active={isPhoneMode}>
              {viewIcon}
            </IconBtn>
            <IconBtn onClick={toggle} title={theme === "dark" ? "Light mode" : "Dark mode"}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </IconBtn>
            <div style={{ height: 1, width: 24, background: "var(--border)", margin: "4px 0" }} />
            <span style={{
              fontFamily: "JetBrains Mono, monospace",
              fontSize: 7, letterSpacing: "0.18em", textTransform: "uppercase",
              color: "var(--text-4)", writingMode: "vertical-rl",
            }}>
              v2
            </span>
          </div>
        </nav>
      )}

      {/* ── Mobile top bar ───────────────────────────────────────────── */}
      {showMobileTopBar && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 12px",
          height: 52,
          background: "var(--surface)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
          gap: 8,
        }}>
          {/* Logo */}
          <span style={{ fontFamily: "Syne, sans-serif", fontSize: 18, fontWeight: 800, color: "var(--text-1)", flexShrink: 0 }}>
            JA
          </span>

          {/* Right controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
            <IconBtn onClick={handleViewToggle} title={viewTitle} active={isDesktopMode}>
              {viewIcon}
            </IconBtn>
            <IconBtn onClick={toggle} title={theme === "dark" ? "Light mode" : "Dark mode"}>
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </IconBtn>

            {/* Hamburger */}
            <button
              onClick={() => setMobileNavOpen(o => !o)}
              style={{
                width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 5,
                background: "var(--surface-2)", border: "1px solid var(--border)",
              }}
            >
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  display: "block", width: 14, height: 1.5, borderRadius: 1,
                  background: "var(--text-2)",
                  transform:
                    mobileNavOpen && i === 0 ? "rotate(45deg) translate(4px, 4px)" :
                    mobileNavOpen && i === 2 ? "rotate(-45deg) translate(4px, -4px)" : "none",
                  opacity: mobileNavOpen && i === 1 ? 0 : 1,
                  transition: "all 0.18s",
                }} />
              ))}
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      {showMobileTopBar && mobileNavOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setMobileNavOpen(false)}>
          <div
            style={{
              position: "absolute", top: 52, left: 0, right: 0,
              padding: "12px 16px", display: "flex", flexWrap: "wrap", gap: 8,
              background: "var(--bg)", borderBottom: "1px solid var(--border)",
            }}
            onClick={e => e.stopPropagation()}
          >
            {NAV.map(({ to, label }) => (
              <NavLink
                key={to} to={to} end={to === "/dashboard"}
                onClick={() => setMobileNavOpen(false)}
                style={({ isActive }) => ({
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "10px 0", borderRadius: 10,
                  fontSize: 13, fontWeight: 600,
                  flex: "1 1 110px",
                  textDecoration: "none",
                  background: isActive ? "var(--accent-bg)" : "transparent",
                  color: isActive ? "var(--text-1)" : "var(--text-2)",
                  border: isActive ? "1px solid var(--border-2)" : "1px solid var(--border)",
                })}
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main style={{
        flex: 1, minWidth: 0,
        overflow: "hidden",
        paddingTop: showMobileTopBar ? 52 : 0,
      }}>
        <Outlet />
      </main>
    </div>
  );
}

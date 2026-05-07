import { useState } from "react";
import client from "../../api/client";

interface ApiKey {
  provider: string;
  key: string;
  status: "idle" | "testing" | "ok" | "error";
  detail?: string;
}

const PROVIDERS = [
  { id: "openai", label: "OpenAI", prefix: "sk-" },
  { id: "gemini", label: "Google Gemini", prefix: "AIza" },
];

const STORAGE_KEY = "ja-api-keys";

function loadSaved(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

function saveToDisk(keys: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export default function ApiKeyManager() {
  const saved = loadSaved();
  const [keys, setKeys] = useState<Record<string, ApiKey>>(() =>
    Object.fromEntries(
      PROVIDERS.map((p) => [
        p.id,
        { provider: p.id, key: saved[p.id] || "", status: "idle" },
      ])
    )
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  function update(provider: string, key: string) {
    setKeys((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], key, status: "idle", detail: undefined },
    }));
  }

  async function test(provider: string) {
    const entry = keys[provider];
    if (!entry.key.trim()) return;

    setKeys((prev) => ({ ...prev, [provider]: { ...prev[provider], status: "testing" } }));

    try {
      const r = await client.post("/integrations/test", {
        provider,
        api_key: entry.key.trim(),
      });
      const detail = r.data?.detail || "Connected";
      setKeys((prev) => ({ ...prev, [provider]: { ...prev[provider], status: "ok", detail } }));
      const allSaved = loadSaved();
      allSaved[provider] = entry.key.trim();
      saveToDisk(allSaved);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Invalid key or unreachable";
      setKeys((prev) => ({ ...prev, [provider]: { ...prev[provider], status: "error", detail: msg } }));
    }
  }

  function remove(provider: string) {
    update(provider, "");
    const allSaved = loadSaved();
    delete allSaved[provider];
    saveToDisk(allSaved);
  }

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, color: "var(--text-4)", lineHeight: 1.5 }}>
        Add your own API keys to use for resume tailoring. Keys are stored in your browser only.
      </p>

      {PROVIDERS.map((p) => {
        const entry = keys[p.id];
        const isOpen = expanded === p.id;
        const dotColor =
          entry.status === "ok"    ? "var(--text-2)" :
          entry.status === "error" ? "var(--text-1)" :
          entry.key                ? "var(--text-4)" :
          "transparent";

        return (
          <div key={p.id} style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            {/* Header */}
            <button
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 12px", fontSize: 12, background: "transparent",
                color: "var(--text-2)",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--surface-2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              onClick={() => setExpanded(isOpen ? null : p.id)}
            >
              <span style={{ fontWeight: 500 }}>{p.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: dotColor, display: "inline-block",
                }} />
                <span style={{ fontSize: 10, color: "var(--text-4)" }}>{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div style={{
                padding: "8px 12px 12px", display: "flex", flexDirection: "column", gap: 8,
                background: "var(--surface-2)", borderTop: "1px solid var(--border)",
              }}>
                <input
                  type="password"
                  value={entry.key}
                  onChange={(e) => update(p.id, e.target.value)}
                  placeholder={`${p.prefix}...`}
                  style={{
                    width: "100%", background: "var(--surface)", border: "1px solid var(--border)",
                    borderRadius: 6, padding: "6px 10px", fontSize: 11,
                    fontFamily: "JetBrains Mono, monospace", color: "var(--text-2)", outline: "none",
                  }}
                  onFocus={e => (e.target.style.borderColor = "var(--border-2)")}
                  onBlur={e => (e.target.style.borderColor = "var(--border)")}
                  onKeyDown={(e) => e.key === "Enter" && test(p.id)}
                />

                {entry.detail && (
                  <p style={{
                    fontFamily: "JetBrains Mono, monospace", fontSize: 9,
                    color: entry.status === "ok" ? "var(--text-2)" : "var(--text-3)",
                  }}>
                    {entry.detail}
                  </p>
                )}

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => test(p.id)}
                    disabled={!entry.key.trim() || entry.status === "testing"}
                    className="btn-primary"
                    style={{ flex: 1, padding: "5px 10px", fontSize: 11 }}
                  >
                    {entry.status === "testing" ? "Testing…" : "Test & Save"}
                  </button>
                  {entry.key && (
                    <button
                      onClick={() => remove(p.id)}
                      className="btn-ghost"
                      style={{ padding: "5px 10px", fontSize: 11 }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

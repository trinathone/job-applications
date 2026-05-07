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
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
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
      setKeys((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], status: "ok", detail },
      }));
      // Persist on success
      const allSaved = loadSaved();
      allSaved[provider] = entry.key.trim();
      saveToDisk(allSaved);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "Invalid key or unreachable";
      setKeys((prev) => ({
        ...prev,
        [provider]: { ...prev[provider], status: "error", detail: msg },
      }));
    }
  }

  function remove(provider: string) {
    update(provider, "");
    const allSaved = loadSaved();
    delete allSaved[provider];
    saveToDisk(allSaved);
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs text-gray-500">
        Add your own API keys to use for resume tailoring. Keys are stored in your browser only.
      </p>

      {PROVIDERS.map((p) => {
        const entry = keys[p.id];
        const isOpen = expanded === p.id;
        const statusColor = {
          idle: "text-gray-500",
          testing: "text-yellow-400",
          ok: "text-green-400",
          error: "text-red-400",
        }[entry.status];

        return (
          <div key={p.id} className="border border-gray-800 rounded-lg overflow-hidden">
            {/* Header */}
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-800 transition-colors"
              onClick={() => setExpanded(isOpen ? null : p.id)}
            >
              <span className="text-gray-300 font-medium">{p.label}</span>
              <div className="flex items-center gap-2">
                {entry.status === "ok" && (
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                )}
                {entry.status === "error" && (
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                )}
                {entry.key && entry.status === "idle" && (
                  <span className="w-2 h-2 rounded-full bg-gray-500 inline-block" />
                )}
                <span className="text-gray-600">{isOpen ? "▲" : "▼"}</span>
              </div>
            </button>

            {/* Expanded content */}
            {isOpen && (
              <div className="px-3 pb-3 pt-1 space-y-2 bg-gray-900/50">
                <input
                  type="password"
                  value={entry.key}
                  onChange={(e) => update(p.id, e.target.value)}
                  placeholder={`${p.prefix}...`}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500 font-mono"
                  onKeyDown={(e) => e.key === "Enter" && test(p.id)}
                />

                {entry.detail && (
                  <p className={`text-xs ${statusColor}`}>{entry.detail}</p>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => test(p.id)}
                    disabled={!entry.key.trim() || entry.status === "testing"}
                    className="flex-1 py-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded font-medium"
                  >
                    {entry.status === "testing" ? "Testing…" : "Test & Save"}
                  </button>
                  {entry.key && (
                    <button
                      onClick={() => remove(p.id)}
                      className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-400 rounded"
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

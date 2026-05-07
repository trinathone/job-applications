/**
 * SSE client with exponential backoff reconnect.
 *
 * Protocol:
 *   - Connects to /api/dashboard/stream
 *   - On disconnect: waits 1s → 2s → 4s → ... capped at 30s, then retries
 *   - Caller must call .close() on unmount
 */

export interface SSEClient {
  close(): void;
}

type MessageHandler = (eventType: string, data: unknown) => void;
type ErrorHandler = (err: Event) => void;

const MAX_BACKOFF_MS = 30_000;

export function createSSEClient(
  url: string,
  onMessage: MessageHandler,
  onError?: ErrorHandler
): SSEClient {
  let es: EventSource | null = null;
  let closed = false;
  let retryDelay = 1_000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  const EVENT_TYPES = [
    "connected",
    "heartbeat",
    "job_update",
    "jobs_new",
    "scrape_complete",
    "job_dead",
  ];

  function connect() {
    if (closed) return;

    es = new EventSource(url);

    // Listen for all known event types
    for (const type of EVENT_TYPES) {
      es.addEventListener(type, (ev: MessageEvent) => {
        retryDelay = 1_000; // reset on successful message
        try {
          const parsed = JSON.parse(ev.data);
          onMessage(type, parsed);
        } catch {
          onMessage(type, ev.data);
        }
      });
    }

    // Fallback for unnamed events
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        onMessage("message", parsed);
      } catch {
        onMessage("message", ev.data);
      }
    };

    es.onerror = (err) => {
      onError?.(err);
      es?.close();
      es = null;

      if (!closed) {
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, MAX_BACKOFF_MS);
          connect();
        }, retryDelay);
      }
    };
  }

  connect();

  return {
    close() {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      es = null;
    },
  };
}

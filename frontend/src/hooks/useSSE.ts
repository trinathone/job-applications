import { useEffect, useRef } from "react";
import { createSSEClient } from "../api/sse";

type Handler = (eventType: string, data: unknown) => void;

export function useSSE(url: string, onMessage: Handler, enabled = true) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;

    const client = createSSEClient(
      url,
      (type, data) => handlerRef.current(type, data)
    );

    return () => client.close();
  }, [url, enabled]);
}

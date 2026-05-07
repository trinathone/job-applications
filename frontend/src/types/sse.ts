export type SSEEventType =
  | "connected"
  | "heartbeat"
  | "job_update"
  | "jobs_new"
  | "scrape_complete"
  | "job_dead";

export interface SSEEvent {
  event: SSEEventType;
  data: Record<string, unknown>;
  ts?: string;
}

export interface JobsNewPayload {
  ats: string;
  slug: string;
  job_ids: number[];
  count: number;
}

export interface ScrapeCompletePayload {
  jobs_new: number;
  jobs_total: number;
  sources: Record<string, number>;
  run_id: string | null;
}

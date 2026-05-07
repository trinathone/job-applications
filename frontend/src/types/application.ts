export type ApplicationStatus =
  | "saved"
  | "applied"
  | "interviewing"
  | "offer"
  | "rejected"
  | "archived"
  | "skipped";

export interface Application {
  id: number;
  job_id: number;
  user_id: number;
  status: ApplicationStatus;
  skip_reason: string | null;
  applied_at: string | null;
  session_date: string;
  notes: string | null;
  got_response: boolean | null;
  created_at: string;
  updated_at: string;
}

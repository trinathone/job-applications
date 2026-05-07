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
  // Enriched job fields (populated on GET /applications)
  job_title: string | null;
  job_company_name: string | null;
  job_url: string | null;
}

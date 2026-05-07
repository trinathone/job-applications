import client from "./client";
import type { Application, ApplicationStatus } from "../types/application";

// user_id is NOT sent — the backend reads it from the Bearer token
export async function upsertApplication(
  jobId: number,
  status: ApplicationStatus,
  extras: Partial<{ skip_reason: string; notes: string; cover_letter: string }> = {}
): Promise<Application> {
  const { data } = await client.post<Application>("/applications", {
    job_id: jobId,
    status,
    ...extras,
  });
  return data;
}

export async function updateApplication(
  id: number,
  update: Partial<{ status: ApplicationStatus; notes: string; got_response: boolean }>
): Promise<Application> {
  const { data } = await client.patch<Application>(`/applications/${id}`, update);
  return data;
}

export async function listApplications(): Promise<Application[]> {
  const { data } = await client.get<Application[]>("/applications");
  return data;
}

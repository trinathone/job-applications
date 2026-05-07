import client from "./client";
import type { Job, JobListResponse } from "../types/job";

export interface JobFilters {
  ats?: string;
  remote?: boolean;
  yoe_max?: number;
  cursor?: string;
  limit?: number;
}

export async function fetchJobs(filters: JobFilters = {}): Promise<JobListResponse> {
  const params: Record<string, string | number | boolean> = { limit: filters.limit ?? 50 };
  if (filters.ats) params.ats = filters.ats;
  if (filters.remote !== undefined) params.remote = filters.remote;
  if (filters.yoe_max !== undefined) params.yoe_max = filters.yoe_max;
  if (filters.cursor) params.cursor = filters.cursor;

  const { data } = await client.get<JobListResponse>("/jobs", { params });
  return data;
}

export async function fetchJob(id: number): Promise<Job> {
  const { data } = await client.get<Job>(`/jobs/${id}`);
  return data;
}

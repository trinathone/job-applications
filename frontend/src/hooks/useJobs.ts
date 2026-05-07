import { useQuery } from "@tanstack/react-query";
import { fetchJobs, type JobFilters } from "../api/jobs";

export function useJobs(filters: JobFilters = {}) {
  return useQuery({
    queryKey: ["jobs", filters],
    queryFn: () => fetchJobs(filters),
    staleTime: 60_000,
  });
}

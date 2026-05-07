import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listApplications, upsertApplication } from "../api/applications";
import { useJobStore } from "../store/jobStore";
import type { ApplicationStatus } from "../types/application";

export function useApplications() {
  return useQuery({
    queryKey: ["applications"],
    queryFn: listApplications,
  });
}

export function useApplyJob() {
  const qc = useQueryClient();
  const markApplied = useJobStore((s) => s.markApplied);
  const nextJob = useJobStore((s) => s.nextJob);

  return useMutation({
    mutationFn: ({ jobId, status }: { jobId: number; status: ApplicationStatus }) =>
      upsertApplication(jobId, status),
    onSuccess: (_data, variables) => {
      markApplied(variables.jobId);
      qc.invalidateQueries({ queryKey: ["applications"] });
      // Auto-advance to next job after applying/skipping
      nextJob();
    },
  });
}

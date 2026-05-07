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
  const qc         = useQueryClient();
  const markApplied = useJobStore((s) => s.markApplied);
  const nextJob     = useJobStore((s) => s.nextJob);

  return useMutation({
    mutationFn: ({ jobId, status }: { jobId: number; status: ApplicationStatus }) =>
      upsertApplication(jobId, status),
    onSuccess: (_data, vars) => {
      markApplied(vars.jobId);
      qc.invalidateQueries({ queryKey: ["applications"] });
      nextJob();
    },
  });
}

/** Only the API call — store updates handled manually so undo works. */
export function useSkipJobApi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId }: { jobId: number }) =>
      upsertApplication(jobId, "skipped"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

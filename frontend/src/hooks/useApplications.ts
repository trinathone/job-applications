import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listApplications, upsertApplication } from "../api/applications";
import { useJobStore } from "../store/jobStore";
import { useAuthStore } from "../store/authStore";
import type { ApplicationStatus } from "../types/application";

export function useApplications() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["applications"],
    queryFn: listApplications,
    enabled: !!token,
  });
}

export function useApplyJob() {
  const qc         = useQueryClient();
  const markApplied = useJobStore((s) => s.markApplied);
  const nextJob     = useJobStore((s) => s.nextJob);
  const token        = useAuthStore((s) => s.token);

  return useMutation({
    mutationFn: ({ jobId, status }: { jobId: number; status: ApplicationStatus }) =>
      token ? upsertApplication(jobId, status) : Promise.resolve(null),
    onSuccess: (_data, vars) => {
      markApplied(vars.jobId);
      if (token) qc.invalidateQueries({ queryKey: ["applications"] });
      nextJob();
    },
  });
}

/** Only the API call — store updates handled manually so undo works. */
export function useSkipJobApi() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  return useMutation({
    mutationFn: ({ jobId }: { jobId: number }) =>
      token ? upsertApplication(jobId, "skipped") : Promise.resolve(null),
    onSuccess: () => {
      if (token) qc.invalidateQueries({ queryKey: ["applications"] });
    },
  });
}

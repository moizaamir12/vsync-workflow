import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ── Keys ────────────────────────────────────────────────────── */

export const runKeys = {
  all: ["runs"] as const,
  lists: () => [...runKeys.all, "list"] as const,
  list: (filters?: object) => [...runKeys.lists(), filters] as const,
  details: () => [...runKeys.all, "detail"] as const,
  detail: (id: string) => [...runKeys.details(), id] as const,
  stats: () => [...runKeys.all, "stats"] as const,
};

/* ── Queries ─────────────────────────────────────────────────── */

export function useRuns(filters?: {
  workflowId?: string;
  status?: string;
  cursor?: string;
}) {
  return useQuery({
    queryKey: runKeys.list(filters),
    queryFn: () =>
      api.runs.list({
        ...filters,
        pageSize: 50,
      }),
  });
}

export function useRun(id: string) {
  return useQuery({
    queryKey: runKeys.detail(id),
    queryFn: () => api.runs.get(id),
    enabled: !!id,
    /* Refetch running runs more frequently */
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === "running" || status === "pending" ? 3000 : false;
    },
  });
}

/**
 * Aggregated dashboard statistics.
 * Fetches all workflows + recent runs in parallel and computes
 * totals, success rate, etc. on the client side.
 */
export function useDashboardStats() {
  return useQuery({
    queryKey: runKeys.stats(),
    queryFn: async () => {
      const [workflowsRes, runsRes] = await Promise.all([
        api.workflows.list({ pageSize: 250 }),
        api.runs.list({ pageSize: 250 }),
      ]);

      const workflows = workflowsRes.data ?? [];
      const runs = runsRes.data ?? [];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const runsToday = runs.filter((r) => {
        const created = new Date(r.createdAt ?? "");
        return created >= today;
      });

      const completed = runs.filter((r) => r.status === "completed").length;
      const failed = runs.filter((r) => r.status === "failed").length;
      const successRate =
        completed + failed > 0
          ? Math.round((completed / (completed + failed)) * 100)
          : 0;

      return {
        totalWorkflows: workflows.length,
        runsToday: runsToday.length,
        successRate,
        totalRuns: runs.length,
        recentRuns: runs.slice(0, 10),
      };
    },
    staleTime: 15_000,
  });
}

/* ── Mutations ───────────────────────────────────────────────── */

export function useTriggerRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      workflowId,
      input,
    }: {
      workflowId: string;
      input?: Record<string, unknown>;
    }) => api.runs.trigger(workflowId, { input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: runKeys.lists() });
      void qc.invalidateQueries({ queryKey: runKeys.stats() });
    },
  });
}

export function useCancelRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.runs.cancel(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: runKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: runKeys.lists() });
    },
  });
}

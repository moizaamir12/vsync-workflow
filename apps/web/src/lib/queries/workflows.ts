import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ── Keys ────────────────────────────────────────────────────── */

export const workflowKeys = {
  all: ["workflows"] as const,
  lists: () => [...workflowKeys.all, "list"] as const,
  list: (cursor?: string) => [...workflowKeys.lists(), cursor] as const,
  details: () => [...workflowKeys.all, "detail"] as const,
  detail: (id: string) => [...workflowKeys.details(), id] as const,
  versions: (id: string) => [...workflowKeys.detail(id), "versions"] as const,
  blocks: (id: string, version: number) =>
    [...workflowKeys.detail(id), "blocks", version] as const,
};

/* ── Queries ─────────────────────────────────────────────────── */

export function useWorkflows(cursor?: string) {
  return useQuery({
    queryKey: workflowKeys.list(cursor),
    queryFn: () => api.workflows.list({ cursor, pageSize: 50 }),
  });
}

export function useWorkflow(id: string) {
  return useQuery({
    queryKey: workflowKeys.detail(id),
    queryFn: () => api.workflows.get(id),
    enabled: !!id,
  });
}

export function useWorkflowVersions(workflowId: string) {
  return useQuery({
    queryKey: workflowKeys.versions(workflowId),
    queryFn: () => api.versions.list(workflowId),
    enabled: !!workflowId,
  });
}

export function useWorkflowBlocks(workflowId: string, version: number) {
  return useQuery({
    queryKey: workflowKeys.blocks(workflowId, version),
    queryFn: () => api.blocks.list(workflowId, version),
    enabled: !!workflowId && version > 0,
  });
}

/* ── Mutations ───────────────────────────────────────────────── */

export function useCreateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; triggerType?: string }) =>
      api.workflows.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
}

export function useUpdateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      isDisabled?: boolean;
    }) => api.workflows.update(id, data),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: workflowKeys.detail(variables.id) });
      void qc.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.workflows.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
}

export function useDuplicateWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.workflows.duplicate(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: workflowKeys.lists() });
    },
  });
}

export function usePublishVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, version }: { workflowId: string; version: number }) =>
      api.versions.publish(workflowId, version),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({
        queryKey: workflowKeys.versions(variables.workflowId),
      });
    },
  });
}

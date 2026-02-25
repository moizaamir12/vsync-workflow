import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ── Keys ────────────────────────────────────────────────────── */

export const keyKeys = {
  all: ["keys"] as const,
  lists: () => [...keyKeys.all, "list"] as const,
  list: (workflowId?: string) => [...keyKeys.lists(), workflowId] as const,
  audit: (id: string) => [...keyKeys.all, "audit", id] as const,
};

export const apiKeyKeys = {
  all: ["api-keys"] as const,
  lists: () => [...apiKeyKeys.all, "list"] as const,
};

/* ── Key Queries ─────────────────────────────────────────────── */

export function useKeys(workflowId?: string) {
  return useQuery({
    queryKey: keyKeys.list(workflowId),
    queryFn: () => api.keys.list(workflowId ? { workflowId } : undefined),
  });
}

export function useKeyAudit(id: string) {
  return useQuery({
    queryKey: keyKeys.audit(id),
    queryFn: () => api.keys.audit(id),
    enabled: !!id,
  });
}

/* ── Key Mutations ───────────────────────────────────────────── */

export function useCreateKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      value: string;
      description?: string;
      keyType: string;
      provider: string;
      storageMode: string;
      workflowId?: string;
      expiresAt?: string;
    }) => api.keys.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keyKeys.lists() });
    },
  });
}

export function useRotateKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.keys.rotate(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: keyKeys.lists() });
      void qc.invalidateQueries({ queryKey: keyKeys.audit(id) });
    },
  });
}

export function useRevokeKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.keys.revoke(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: keyKeys.lists() });
      void qc.invalidateQueries({ queryKey: keyKeys.audit(id) });
    },
  });
}

/* ── API Key Queries ─────────────────────────────────────────── */

export function useApiKeys() {
  return useQuery({
    queryKey: apiKeyKeys.lists(),
    queryFn: () => api.apiKeys.list(),
  });
}

/* ── API Key Mutations ───────────────────────────────────────── */

export function useCreateApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; expiresAt?: string }) =>
      api.apiKeys.create(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: apiKeyKeys.lists() });
    },
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.apiKeys.revoke(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: apiKeyKeys.lists() });
    },
  });
}

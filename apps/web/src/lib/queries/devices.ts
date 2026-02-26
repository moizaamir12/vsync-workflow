import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ── Keys ────────────────────────────────────────────────────── */

export const deviceKeys = {
  all: ["devices"] as const,
  lists: () => [...deviceKeys.all, "list"] as const,
  details: () => [...deviceKeys.all, "detail"] as const,
  detail: (id: string) => [...deviceKeys.details(), id] as const,
};

/* ── Queries ─────────────────────────────────────────────────── */

// TODO: Add refetchInterval to keep device heartbeat status fresh — currently only fetched on mount.
export function useDevices() {
  return useQuery({
    queryKey: deviceKeys.lists(),
    queryFn: () => api.devices.list(),
  });
}

export function useDevice(id: string) {
  return useQuery({
    queryKey: deviceKeys.detail(id),
    queryFn: () => api.devices.get(id),
    enabled: !!id,
  });
}

/* ── Mutations ───────────────────────────────────────────────── */

export function useRegisterDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      hardwareId: string;
      platform?: string;
      arch?: string;
      executionEnvironment?: string;
      tags?: Record<string, unknown>;
      cpuCores?: number;
      memoryGb?: number;
      diskGb?: number;
    }) => api.devices.register(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.devices.update(id, data),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: deviceKeys.detail(variables.id) });
      void qc.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.devices.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deviceKeys.lists() });
    },
  });
}

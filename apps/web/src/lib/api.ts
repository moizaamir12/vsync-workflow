import type {
  ApiResponse,
  Workflow,
  WorkflowVersion,
  Block,
  Run,
  Step,
  Artifact,
  Organization,
  User,
  PaginationParams,
} from "@vsync/shared-types";

/* ── Configuration ───────────────────────────────────────────── */

export interface ApiClientConfig {
  baseUrl: string;
  sessionToken?: string;
}

/* ── Error class ─────────────────────────────────────────────── */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/* ── Factory ─────────────────────────────────────────────────── */

export function createApiClient(baseUrl: string, sessionToken?: string) {
  let token = sessionToken;

  /* ── Core fetch wrapper ──────────────────── */

  async function request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const body = (await res.json()) as ApiResponse<T>;

    if (!res.ok) {
      throw new ApiError(
        res.status,
        body.error?.code ?? "UNKNOWN",
        body.error?.message ?? `Request failed with status ${res.status}`,
        body.error?.details,
      );
    }

    return body;
  }

  function get<T>(path: string) {
    return request<T>(path, { method: "GET" });
  }

  function post<T>(path: string, data?: unknown) {
    return request<T>(path, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  function patch<T>(path: string, data?: unknown) {
    return request<T>(path, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  function del<T>(path: string, data?: unknown) {
    return request<T>(path, {
      method: "DELETE",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /* ── Query string helper ─────────────────── */

  function qs(params: object): string {
    const entries = Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== null && v !== "",
    );
    if (entries.length === 0) return "";
    return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
  }

  return {
    /* ── Token management ──────────────────── */

    setToken(newToken: string | undefined) {
      token = newToken;
    },

    /* ── Workflows ─────────────────────────── */

    workflows: {
      list(params?: PaginationParams) {
        return get<Workflow[]>(`/api/v1/workflows${qs(params ?? {})}`);
      },
      get(id: string) {
        return get<Workflow & { version?: WorkflowVersion }>(`/api/v1/workflows/${id}`);
      },
      create(data: { name: string; description?: string; triggerType?: string }) {
        return post<Workflow>("/api/v1/workflows", data);
      },
      update(id: string, data: Partial<Pick<Workflow, "name" | "description" | "isDisabled">>) {
        return patch<Workflow>(`/api/v1/workflows/${id}`, data);
      },
      delete(id: string) {
        return del<{ deleted: boolean }>(`/api/v1/workflows/${id}`);
      },
      lock(id: string) {
        return post<Workflow>(`/api/v1/workflows/${id}/lock`);
      },
      unlock(id: string) {
        return del<Workflow>(`/api/v1/workflows/${id}/lock`);
      },
      duplicate(id: string) {
        return post<Workflow>(`/api/v1/workflows/${id}/duplicate`);
      },
    },

    /* ── Versions ──────────────────────────── */

    versions: {
      list(workflowId: string) {
        return get<WorkflowVersion[]>(`/api/v1/workflows/${workflowId}/versions`);
      },
      get(workflowId: string, version: number) {
        return get<WorkflowVersion>(`/api/v1/workflows/${workflowId}/versions/${version}`);
      },
      create(workflowId: string, data?: { changelog?: string }) {
        return post<WorkflowVersion>(`/api/v1/workflows/${workflowId}/versions`, data);
      },
      update(
        workflowId: string,
        version: number,
        data: Partial<Pick<WorkflowVersion, "triggerType" | "triggerConfig" | "changelog">>,
      ) {
        return patch<WorkflowVersion>(`/api/v1/workflows/${workflowId}/versions/${version}`, data);
      },
      publish(workflowId: string, version: number) {
        return post<WorkflowVersion>(`/api/v1/workflows/${workflowId}/versions/${version}/publish`);
      },
      delete(workflowId: string, version: number) {
        return del<{ deleted: boolean }>(`/api/v1/workflows/${workflowId}/versions/${version}`);
      },
    },

    /* ── Blocks ────────────────────────────── */

    blocks: {
      list(workflowId: string, version: number) {
        return get<Block[]>(`/api/v1/workflows/${workflowId}/versions/${version}/blocks`);
      },
      create(workflowId: string, version: number, data: Omit<Block, "id">) {
        return post<Block>(`/api/v1/workflows/${workflowId}/versions/${version}/blocks`, data);
      },
      update(workflowId: string, version: number, blockId: string, data: Partial<Block>) {
        return patch<Block>(
          `/api/v1/workflows/${workflowId}/versions/${version}/blocks/${blockId}`,
          data,
        );
      },
      delete(workflowId: string, version: number, blockId: string) {
        return del<{ deleted: boolean }>(
          `/api/v1/workflows/${workflowId}/versions/${version}/blocks/${blockId}`,
        );
      },
      reorder(workflowId: string, version: number, orderedIds: string[]) {
        return post<{ reordered: boolean }>(
          `/api/v1/workflows/${workflowId}/versions/${version}/blocks/reorder`,
          { orderedIds },
        );
      },
    },

    /* ── Runs ──────────────────────────────── */

    runs: {
      list(params?: PaginationParams & { workflowId?: string; status?: string }) {
        return get<Run[]>(`/api/v1/runs${qs(params ?? {})}`);
      },
      get(id: string) {
        return get<Run & { steps?: Step[] }>(`/api/v1/runs/${id}`);
      },
      trigger(workflowId: string, data?: { triggerSource?: string; input?: Record<string, unknown> }) {
        return post<Run>(`/api/v1/workflows/${workflowId}/trigger`, data);
      },
      cancel(id: string) {
        return post<Run>(`/api/v1/runs/${id}/cancel`);
      },
      submitAction(id: string, action: Record<string, unknown>) {
        return post<Run>(`/api/v1/runs/${id}/actions`, action);
      },
      delete(id: string) {
        return del<{ deleted: boolean }>(`/api/v1/runs/${id}`);
      },
      /** Returns an EventSource URL for live SSE updates */
      liveUrl(id: string): string {
        const base = `${baseUrl}/api/v1/runs/${id}/live`;
        return token ? `${base}?token=${token}` : base;
      },
    },

    /* ── Artifacts ─────────────────────────── */

    artifacts: {
      list(runId: string) {
        return get<Artifact[]>(`/api/v1/artifacts?runId=${runId}`);
      },
      get(id: string) {
        return get<Artifact>(`/api/v1/artifacts/${id}`);
      },
      create(data: FormData) {
        /* Uses FormData so we skip JSON content-type */
        return request<Artifact>("/api/v1/artifacts", {
          method: "POST",
          body: data,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      },
      delete(id: string) {
        return del<{ deleted: boolean }>(`/api/v1/artifacts/${id}`);
      },
    },

    /* ── Organizations ─────────────────────── */

    orgs: {
      list() {
        return get<Organization[]>("/api/v1/orgs");
      },
      get(id: string) {
        return get<Organization>(`/api/v1/orgs/${id}`);
      },
      create(data: { name: string; slug?: string }) {
        return post<Organization>("/api/v1/orgs", data);
      },
      update(id: string, data: Partial<Pick<Organization, "name">>) {
        return patch<Organization>(`/api/v1/orgs/${id}`, data);
      },
      members: {
        list(orgId: string) {
          return get<User[]>(`/api/v1/orgs/${orgId}/members`);
        },
        invite(orgId: string, data: { email: string; role?: string }) {
          return post<User>(`/api/v1/orgs/${orgId}/members`, data);
        },
        updateRole(orgId: string, userId: string, role: string) {
          return patch<User>(`/api/v1/orgs/${orgId}/members/${userId}`, { role });
        },
        remove(orgId: string, userId: string) {
          return del<{ removed: boolean }>(`/api/v1/orgs/${orgId}/members/${userId}`);
        },
      },
      configureSso(orgId: string, data: Record<string, unknown>) {
        return post<{ configured: boolean }>(`/api/v1/orgs/${orgId}/sso`, data);
      },
    },

    /* ── Devices ──────────────────────────── */

    devices: {
      list() {
        return get<Array<{
          id: string;
          name: string;
          slug: string;
          hardwareId: string;
          platform?: string;
          arch?: string;
          executionEnvironment: string;
          tags?: Record<string, unknown>;
          cpuCores?: number;
          memoryGb?: number;
          diskGb?: number;
          lastSeenAt: string;
          createdAt: string;
          updatedAt: string;
        }>>("/api/v1/devices");
      },
      get(id: string) {
        return get<{
          id: string;
          name: string;
          slug: string;
          hardwareId: string;
          platform?: string;
          arch?: string;
          executionEnvironment: string;
          tags?: Record<string, unknown>;
          cpuCores?: number;
          memoryGb?: number;
          diskGb?: number;
          lastSeenAt: string;
          createdAt: string;
          updatedAt: string;
        }>(`/api/v1/devices/${id}`);
      },
      register(data: {
        name: string;
        hardwareId: string;
        platform?: string;
        arch?: string;
        executionEnvironment?: string;
        tags?: Record<string, unknown>;
        cpuCores?: number;
        memoryGb?: number;
        diskGb?: number;
      }) {
        return post<{ id: string }>("/api/v1/devices", data);
      },
      update(id: string, data: Record<string, unknown>) {
        return patch<{ updated: boolean }>(`/api/v1/devices/${id}`, data);
      },
      delete(id: string) {
        return del<{ deleted: boolean }>(`/api/v1/devices/${id}`);
      },
      heartbeat(id: string) {
        return post<{ ok: boolean }>(`/api/v1/devices/${id}/heartbeat`);
      },
    },

    /* ── Keys (Key Manager) ──────────────── */

    keys: {
      list(params?: { workflowId?: string }) {
        return get<Array<{
          id: string;
          name: string;
          description: string | null;
          keyType: string;
          provider: string;
          storageMode: string;
          workflowId: string | null;
          lastUsedAt: string | null;
          expiresAt: string | null;
          isRevoked: boolean;
          createdAt: string | null;
        }>>(`/api/v1/keys${qs(params ?? {})}`);
      },
      create(data: {
        name: string;
        value: string;
        description?: string;
        keyType: string;
        provider: string;
        storageMode: string;
        workflowId?: string;
        expiresAt?: string;
      }) {
        return post<{ id: string; value: string }>("/api/v1/keys", data);
      },
      rotate(id: string) {
        return post<{ id: string; value: string }>(`/api/v1/keys/${id}/rotate`);
      },
      revoke(id: string) {
        return post<{ revoked: boolean }>(`/api/v1/keys/${id}/revoke`);
      },
      audit(id: string) {
        return get<Array<{
          id: string;
          keyId: string;
          action: string;
          performedBy: string | null;
          ipAddress: string | null;
          userAgent: string | null;
          metadata: Record<string, unknown> | null;
          createdAt: string | null;
        }>>(`/api/v1/keys/${id}/audit`);
      },
    },

    /* ── API Keys (programmatic access) ──── */

    apiKeys: {
      list() {
        return get<Array<{
          id: string;
          name: string;
          prefix: string;
          lastUsedAt: string | null;
          expiresAt: string | null;
          createdAt: string;
        }>>("/api/v1/api-keys");
      },
      create(data: { name: string; expiresAt?: string }) {
        return post<{ id: string; key: string }>("/api/v1/api-keys", data);
      },
      revoke(id: string) {
        return del<{ revoked: boolean }>(`/api/v1/api-keys/${id}`);
      },
    },

    /* ── Public Workflows ───────────────────── */

    publicWorkflows: {
      /** Get public workflow config by slug (no auth needed) */
      getConfig(slug: string) {
        return get<{
          slug: string;
          name: string;
          description: string | null;
          branding: {
            title?: string;
            description?: string;
            accentColor?: string;
            logoUrl?: string;
            hideVsyncBranding?: boolean;
          };
          accessMode: string;
          triggerType: string;
          blockCount: number;
          blocks: Array<{ id: string; name: string; type: string; order: number }>;
          environments: unknown;
        }>(`/api/v1/public/${slug}`);
      },
      /** Trigger a public run (no auth needed) */
      triggerRun(slug: string, eventData?: Record<string, unknown>) {
        return post<{ runId: string }>(`/api/v1/public/${slug}/run`, { eventData: eventData ?? {} });
      },
      /** Get public run status */
      getRunStatus(slug: string, runId: string) {
        return get<{
          id: string;
          status: string;
          startedAt: string | null;
          completedAt: string | null;
          durationMs: number | null;
          errorMessage: string | null;
          stepsJson: unknown;
        }>(`/api/v1/public/${slug}/runs/${runId}`);
      },
      /** Submit user action on a public run */
      submitAction(slug: string, runId: string, payload: Record<string, unknown>) {
        return post<{ message: string; runId: string }>(
          `/api/v1/public/${slug}/runs/${runId}/actions`,
          { actionType: "user_input", payload },
        );
      },
      /** SSE live URL for a public run */
      liveUrl(slug: string, runId: string): string {
        return `${baseUrl}/api/v1/public/${slug}/runs/${runId}/live`;
      },
    },

    /* ── Workflow Sharing ────────────────────── */

    sharing: {
      /** Publish a workflow as public */
      publish(
        workflowId: string,
        data: {
          accessMode?: "view" | "run";
          slug?: string;
          branding?: {
            title?: string;
            description?: string;
            accentColor?: string;
            logoUrl?: string;
            hideVsyncBranding?: boolean;
          };
          rateLimit?: { maxPerMinute: number };
        },
      ) {
        return post<Workflow>(`/api/v1/workflows/${workflowId}/publish-public`, data);
      },
      /** Unpublish a workflow */
      unpublish(workflowId: string) {
        return del<Workflow>(`/api/v1/workflows/${workflowId}/publish-public`);
      },
    },

    /* ── Health ─────────────────────────────── */

    health() {
      return get<{ status: string }>("/api/v1/health");
    },
  };
}

/* ── Singleton ───────────────────────────────────────────────── */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const api = createApiClient(API_URL);

export type VsyncApiClient = ReturnType<typeof createApiClient>;

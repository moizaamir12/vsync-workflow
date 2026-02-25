import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ApiResponse } from "@vsync/shared-types";
import { API_BASE_URL, TOKEN_REFRESH_THRESHOLD_MS } from "../constants/config";

/* ── Storage keys ──────────────────────────────────────────── */

const STORAGE_KEYS = {
  accessToken: "vsync:access_token",
  refreshToken: "vsync:refresh_token",
  tokenExpiry: "vsync:token_expiry",
  orgId: "vsync:org_id",
} as const;

/* ── Token management ──────────────────────────────────────── */

async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.accessToken);
}

async function getOrgId(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.orgId);
}

export async function setTokens(access: string, refresh: string, expiresAt: string): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEYS.accessToken, access],
    [STORAGE_KEYS.refreshToken, refresh],
    [STORAGE_KEYS.tokenExpiry, expiresAt],
  ]);
}

export async function setOrgId(orgId: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.orgId, orgId);
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.accessToken,
    STORAGE_KEYS.refreshToken,
    STORAGE_KEYS.tokenExpiry,
    STORAGE_KEYS.orgId,
  ]);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}

/* ── Auto-refresh ──────────────────────────────────────────── */

async function maybeRefreshToken(): Promise<void> {
  const expiryStr = await AsyncStorage.getItem(STORAGE_KEYS.tokenExpiry);
  if (!expiryStr) return;

  const expiresAt = new Date(expiryStr).getTime();
  const now = Date.now();

  /* Still fresh enough — no refresh needed */
  if (expiresAt - now > TOKEN_REFRESH_THRESHOLD_MS) return;

  const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) return;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      await clearTokens();
      return;
    }

    const body = (await res.json()) as ApiResponse<{
      token: string;
      refreshToken: string;
      expiresAt: string;
    }>;

    if (body.data) {
      await setTokens(body.data.token, body.data.refreshToken, body.data.expiresAt);
    }
  } catch {
    /* Silently fail — next request will retry */
  }
}

/* ── API client ────────────────────────────────────────────── */

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip auth header (for login/signup). */
  skipAuth?: boolean;
}

/**
 * Typed fetch wrapper that matches the cloud API envelope shape.
 * Automatically attaches auth tokens and org ID headers.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { method = "GET", body, headers = {}, skipAuth = false } = options;

  if (!skipAuth) {
    await maybeRefreshToken();
  }

  const token = skipAuth ? null : await getAccessToken();
  const orgId = await getOrgId();

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }
  if (orgId) {
    requestHeaders["X-Org-Id"] = orgId;
  }

  const url = `${API_BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as ApiResponse<T>;
  return json;
}

/* ── Convenience helpers ───────────────────────────────────── */

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
};

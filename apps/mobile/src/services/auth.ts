import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { apiRequest, setTokens, clearTokens } from "./api";
import type { ApiResponse } from "@vsync/shared-types";
import { OAUTH_REDIRECT_URI } from "../constants/config";

/* Complete any pending auth sessions when this module loads. */
WebBrowser.maybeCompleteAuthSession();

/* ── Secure token helpers ──────────────────────────────────── */

const SECURE_KEY = "vsync:secure_token";

/** Store the primary auth token in the OS keychain. */
export async function storeSecureToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEY, token);
}

/** Read the primary auth token from the OS keychain. */
export async function getSecureToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SECURE_KEY);
}

/** Remove the primary auth token from the OS keychain. */
export async function clearSecureToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_KEY);
}

/* ── Types ─────────────────────────────────────────────────── */

interface AuthTokens {
  token: string;
  refreshToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

/** Error-only response helper — avoids null ↔ T assignability issues. */
function errorResponse(code: string, message: string): ApiResponse<AuthTokens> {
  return { data: undefined as unknown as AuthTokens, error: { code, message } };
}

/* ── Email / password ──────────────────────────────────────── */

/**
 * Authenticate with email and password.
 * Stores tokens in AsyncStorage and the primary token in SecureStore.
 */
export async function loginWithEmail(
  email: string,
  password: string,
): Promise<ApiResponse<AuthTokens>> {
  const res = await apiRequest<AuthTokens>("/auth/login", {
    method: "POST",
    body: { email, password },
    skipAuth: true,
  });

  if (res.data) {
    await setTokens(res.data.token, res.data.refreshToken, res.data.expiresAt);
    await storeSecureToken(res.data.token);
  }

  return res;
}

/**
 * Register a new account with email and password.
 * Automatically logs in on success.
 */
export async function signupWithEmail(
  email: string,
  password: string,
  name: string,
): Promise<ApiResponse<AuthTokens>> {
  const res = await apiRequest<AuthTokens>("/auth/signup", {
    method: "POST",
    body: { email, password, name },
    skipAuth: true,
  });

  if (res.data) {
    await setTokens(res.data.token, res.data.refreshToken, res.data.expiresAt);
    await storeSecureToken(res.data.token);
  }

  return res;
}

/* ── OAuth flows ───────────────────────────────────────────── */

/**
 * Initiate a Google Sign-In flow via expo-web-browser.
 * The server handles the token exchange and returns JWT tokens.
 */
export async function loginWithGoogle(): Promise<ApiResponse<AuthTokens>> {
  return performOAuthFlow("google");
}

/**
 * Initiate a Microsoft Sign-In flow via expo-web-browser.
 */
export async function loginWithMicrosoft(): Promise<ApiResponse<AuthTokens>> {
  return performOAuthFlow("microsoft");
}

async function performOAuthFlow(
  provider: "google" | "microsoft",
): Promise<ApiResponse<AuthTokens>> {
  /* Step 1: Get the auth URL from the server */
  const initRes = await apiRequest<{ authUrl: string }>("/auth/oauth/init", {
    method: "POST",
    body: { provider, redirectUrl: OAUTH_REDIRECT_URI },
    skipAuth: true,
  });

  if (!initRes.data?.authUrl) {
    return errorResponse("OAUTH_INIT_FAILED", "Failed to initiate OAuth flow");
  }

  /* Step 2: Open the system browser for user consent */
  const result = await WebBrowser.openAuthSessionAsync(
    initRes.data.authUrl,
    OAUTH_REDIRECT_URI,
  );

  if (result.type !== "success" || !("url" in result)) {
    return errorResponse("OAUTH_CANCELLED", "OAuth flow was cancelled");
  }

  /* Step 3: Parse the redirect URL for the authorization code */
  const redirectUrl = new URL(result.url);
  const code = redirectUrl.searchParams.get("code");

  if (!code) {
    return errorResponse("OAUTH_NO_CODE", "No authorization code in redirect");
  }

  /* Step 4: Exchange the code for tokens */
  const exchangeRes = await apiRequest<AuthTokens>("/auth/oauth/callback", {
    method: "POST",
    body: { provider, code, redirectUrl: OAUTH_REDIRECT_URI },
    skipAuth: true,
  });

  if (exchangeRes.data) {
    await setTokens(
      exchangeRes.data.token,
      exchangeRes.data.refreshToken,
      exchangeRes.data.expiresAt,
    );
    await storeSecureToken(exchangeRes.data.token);
  }

  return exchangeRes;
}

/* ── Logout ────────────────────────────────────────────────── */

export async function logout(): Promise<void> {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch {
    /* Best-effort server logout */
  }
  await clearTokens();
  await clearSecureToken();
}

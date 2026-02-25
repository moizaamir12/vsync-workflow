/** Supported deployment environments. */
export type Environment = "development" | "staging" | "production";

/**
 * Derives the current environment from `process.env.NODE_ENV`.
 * Falls back to `"development"` when the variable is unset or
 * doesn't match a known environment — safe default for local work.
 */
export function detectEnvironment(): Environment {
  const raw = process.env["NODE_ENV"];

  if (raw === "production") return "production";
  if (raw === "staging") return "staging";

  return "development";
}

/** Per-environment API base URLs. */
const API_URLS: Record<Environment, string> = {
  development: "http://localhost:3001",
  staging: "https://staging-api.vsync.io",
  production: "https://api.vsync.io",
};

/** Per-environment web app URLs. */
const WEB_URLS: Record<Environment, string> = {
  development: "http://localhost:3000",
  staging: "https://staging.vsync.io",
  production: "https://vsync.io",
};

/** Per-environment WebSocket URLs. */
const WS_URLS: Record<Environment, string> = {
  development: "ws://localhost:3001/api/v1/ws",
  staging: "wss://staging-api.vsync.io/api/v1/ws",
  production: "wss://api.vsync.io/api/v1/ws",
};

/**
 * Returns the API base URL for the given environment.
 * All HTTP requests to the backend should use this as the origin.
 */
export function getApiUrl(env: Environment): string {
  return API_URLS[env];
}

/**
 * Returns the web application URL for the given environment.
 * Used for building redirect URLs, email links, etc.
 */
export function getWebUrl(env: Environment): string {
  return WEB_URLS[env];
}

/**
 * Returns the WebSocket endpoint for the given environment.
 * Real-time event subscriptions connect to this URL.
 */
export function getWsUrl(env: Environment): string {
  return WS_URLS[env];
}

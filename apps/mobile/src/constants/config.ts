/**
 * Environment-aware configuration constants.
 *
 * In development, the API points at a local machine;
 * in production, it hits the cloud endpoint.
 */

const DEV_API_URL = "http://localhost:3001/api/v1";
const PROD_API_URL = "https://api.vsync.io/api/v1";

export const API_BASE_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;

export const WS_BASE_URL = __DEV__
  ? "ws://localhost:3001/api/v1/ws"
  : "wss://api.vsync.io/api/v1/ws";

/** OAuth redirect URI for expo-auth-session flows. */
export const OAUTH_REDIRECT_URI = "vsync://auth/callback";

/** Token refresh threshold — refresh 5 minutes before expiry. */
export const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

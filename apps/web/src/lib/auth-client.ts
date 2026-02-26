import { createAuthClient, type VsyncAuthClient, type AuthSession } from "@vsync/auth/client";

/* ── Environment ─────────────────────────────────────────────── */

// TODO: Import API_URL from a shared constant instead of duplicating it here.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/* ── Singleton auth client ───────────────────────────────────── */

export const authClient: VsyncAuthClient = createAuthClient(API_URL);

/* ── Re-export types ─────────────────────────────────────────── */

export type { AuthSession, VsyncAuthClient };

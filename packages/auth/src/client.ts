import { createAuthClient as createBetterAuthClient } from "better-auth/client";
import { organizationClient } from "better-auth/client/plugins";

/**
 * Session shape returned from getSession().
 * Extended with organization context for multi-tenant apps.
 */
export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    image?: string;
    emailVerified: boolean;
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
}

/**
 * Creates a type-safe auth client for web, desktop, and mobile apps.
 * Wraps Better Auth's vanilla client with a simplified API surface
 * tailored to the V Sync application.
 *
 * @param apiUrl - The base URL of the API server (e.g. http://localhost:3001)
 */
export function createAuthClient(apiUrl: string) {
  const client = createBetterAuthClient({
    baseURL: apiUrl,
    plugins: [organizationClient()],
  });

  return {
    /** Register a new user with email and password. */
    async signUp(email: string, password: string, name: string) {
      return client.signUp.email({ email, password, name });
    },

    /** Sign in with email and password. */
    async signIn(email: string, password: string) {
      return client.signIn.email({ email, password });
    },

    /** Initiate Google OAuth flow — redirects to Google. */
    async signInWithGoogle() {
      return client.signIn.social({ provider: "google" });
    },

    /** Initiate Microsoft OAuth flow — redirects to Microsoft. */
    async signInWithMicrosoft() {
      return client.signIn.social({ provider: "microsoft" });
    },

    /** End the current session. */
    async signOut() {
      return client.signOut();
    },

    /**
     * Retrieve the active session including user and org context.
     * Returns null when no valid session exists.
     */
    async getSession(): Promise<AuthSession | null> {
      const result = await client.getSession();
      if (!result.data) return null;
      return result.data as unknown as AuthSession;
    },

    /**
     * Switch the active organization for the current session.
     * Used when a user belongs to multiple orgs.
     */
    async switchOrg(orgId: string) {
      return client.organization.setActive({ organizationId: orgId });
    },

    /** Expose the underlying Better Auth client for advanced use. */
    raw: client,
  };
}

/** The type of the auth client, for use in app-level type annotations. */
export type VsyncAuthClient = ReturnType<typeof createAuthClient>;

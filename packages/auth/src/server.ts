import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import { jwt } from "better-auth/plugins/jwt";
import type { Database } from "@vsync/db";
import {
  users,
  sessions,
  accounts,
  verifications,
} from "@vsync/db";
import { Resend } from "resend";

/** Env vars read at startup — typed for safety. */
interface AuthEnv {
  AUTH_SECRET: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  MS_CLIENT_ID?: string;
  MS_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  APP_URL?: string;
}

/**
 * Reads required environment variables with sensible defaults.
 * Throws at startup if AUTH_SECRET is missing so we fail fast
 * rather than silently serving unsigned tokens.
 */
function readEnv(): AuthEnv {
  const AUTH_SECRET = process.env["AUTH_SECRET"];
  if (!AUTH_SECRET) {
    throw new Error("AUTH_SECRET environment variable is required");
  }
  return {
    AUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env["GOOGLE_CLIENT_ID"],
    GOOGLE_CLIENT_SECRET: process.env["GOOGLE_CLIENT_SECRET"],
    MS_CLIENT_ID: process.env["MS_CLIENT_ID"],
    MS_CLIENT_SECRET: process.env["MS_CLIENT_SECRET"],
    RESEND_API_KEY: process.env["RESEND_API_KEY"],
    APP_URL: process.env["APP_URL"] ?? "http://localhost:3000",
  };
}

/**
 * Builds a configured Better Auth instance wired to a Drizzle
 * Postgres database. Call once at server boot and share across
 * request handlers.
 *
 * Features enabled:
 * - Email + password (8-char NIST minimum, no complexity rules)
 * - Google OAuth
 * - Microsoft OAuth
 * - JWT sessions (30-day expiry, 7-day refresh)
 * - Organization plugin (multi-tenant)
 * - Email verification via Resend magic links (24h expiry)
 */
export function createAuthServer(db: Database) {
  const env = readEnv();

  /* Optional Resend transport — gracefully skipped in dev */
  const resend = env.RESEND_API_KEY
    ? new Resend(env.RESEND_API_KEY)
    : undefined;

  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders["google"] = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }

  if (env.MS_CLIENT_ID && env.MS_CLIENT_SECRET) {
    socialProviders["microsoft"] = {
      clientId: env.MS_CLIENT_ID,
      clientSecret: env.MS_CLIENT_SECRET,
    };
  }

  const auth = betterAuth({
    secret: env.AUTH_SECRET,
    baseURL: env.APP_URL,

    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: process.env["E2E"] !== "true",
    },

    socialProviders,

    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24 * 7,  // refresh after 7 days
    },

    plugins: [
      jwt(),
      /**
       * Better Auth manages its own organization + member tables
       * via the Drizzle adapter. We don't pass raw pgTable refs
       * here — the plugin's `schema` option only accepts field
       * mapping overrides, not Drizzle table definitions.
       */
      organization(),
    ],

    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        if (!resend) {
          /* Log to console in development when Resend isn't configured */
          // TODO(security): Remove console logging of verification URLs in production — tokens in logs are a security risk.
          console.log(`[auth] Verification email for ${user.email}: ${url}`);
          return;
        }
        await resend.emails.send({
          from: "V Sync <noreply@vsync.io>",
          to: user.email,
          subject: "Verify your email",
          html: `<a href="${url}">Click here to verify your email</a>`,
        });
      },
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24, // 24 hours
    },

    rateLimit: {
      window: 60,   // 1 minute window
      max: 5,       // 5 attempts per window per IP
    },

    advanced: {
      database: {
        /* The PostgreSQL schema uses UUID columns for all auth table IDs.
           Better Auth defaults to nanoid which is rejected by the uuid type. */
        generateId: "uuid",
      },
    },
  });

  return auth;
}

/** The type of the auth instance, for use in middleware signatures. */
export type AuthInstance = ReturnType<typeof createAuthServer>;

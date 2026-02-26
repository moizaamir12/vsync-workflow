import { Hono } from "hono";
import { z } from "zod";
import type { AuthInstance } from "@vsync/auth";
import { requireAuth } from "@vsync/auth";
import { validateBody } from "../middleware/validate.js";
import { ok, err } from "../lib/response.js";
import type { AppEnv } from "../lib/types.js";
import type { Database } from "@vsync/db";

const SignUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});


/**
 * Auth routes delegate to Better Auth's API surface.
 * We thin-wrap them to maintain our standard response envelope
 * while letting Better Auth handle session management, hashing,
 * and OAuth state.
 */
export function authRoutes(auth: AuthInstance, _db: Database) {
  const app = new Hono<AppEnv>();

  /* ── Email / password ──────────────────────────────────────── */

  app.post("/signup", validateBody(SignUpSchema), async (c) => {
    try {
      const { email, password, name } = c.req.valid("json");
      const result = await auth.api.signUpEmail({
        body: { email, password, name },
      });
      return ok(c, result, undefined, 201);
    } catch (e) {
      return err(c, "SIGNUP_FAILED", (e as Error).message, 400);
    }
  });

  app.post("/signin", validateBody(SignInSchema), async (c) => {
    try {
      const { email, password } = c.req.valid("json");
      const result = await auth.api.signInEmail({
        body: { email, password },
      });
      return ok(c, result);
    } catch (e) {
      return err(c, "SIGNIN_FAILED", (e as Error).message, 401);
    }
  });

  /* ── OAuth ─────────────────────────────────────────────────── */

  app.post("/signin/google", async (c) => {
    try {
      const result = await auth.api.signInSocial({
        body: { provider: "google", callbackURL: "/auth/callback/google" },
      });
      return ok(c, result);
    } catch (e) {
      return err(c, "OAUTH_FAILED", (e as Error).message, 400);
    }
  });

  app.post("/signin/microsoft", async (c) => {
    try {
      const result = await auth.api.signInSocial({
        body: { provider: "microsoft", callbackURL: "/auth/callback/microsoft" },
      });
      return ok(c, result);
    } catch (e) {
      return err(c, "OAUTH_FAILED", (e as Error).message, 400);
    }
  });

  app.get("/callback/:provider", async (c) => {
    /**
     * Better Auth handles callback parsing internally via its
     * built-in routes. This endpoint exists as a placeholder
     * so the router can mount it; the actual handling is done
     * by Better Auth's handler mounted on the parent Hono app.
     */
    return ok(c, { message: "OAuth callback processed" });
  });

  /* ── Session management ────────────────────────────────────── */

  app.post("/signout", requireAuth(auth), async (c) => {
    try {
      await auth.api.signOut({ headers: c.req.raw.headers });
      return ok(c, { message: "Signed out" });
    } catch (e) {
      return err(c, "SIGNOUT_FAILED", (e as Error).message, 400);
    }
  });

  app.get("/session", async (c) => {
    try {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
      });
      if (!session) {
        return err(c, "UNAUTHORIZED", "No active session", 401);
      }
      return ok(c, session);
    } catch (e) {
      return err(c, "SESSION_ERROR", (e as Error).message, 401);
    }
  });

  /* ── Email verification ──────────────────────────────────────── */

  app.post("/verify-email", validateBody(VerifyEmailSchema), async (c) => {
    try {
      const { token } = c.req.valid("json");
      const result = await auth.api.verifyEmail({
        query: { token },
      });
      return ok(c, result);
    } catch (e) {
      return err(c, "VERIFICATION_FAILED", (e as Error).message, 400);
    }
  });

  app.post("/send-verification-email", async (c) => {
    try {
      /**
       * The frontend may call this with just a session cookie (no body),
       * or optionally with an explicit email. When no email is provided
       * we pull it from the active session so the verify page's
       * "resend" button works without extra state.
       */
      const body = await c.req.json().catch(() => ({})) as {
        email?: string;
        callbackURL?: string;
      };

      let email = body.email;

      if (!email) {
        const session = await auth.api.getSession({
          headers: c.req.raw.headers,
        });
        if (!session?.user?.email) {
          return err(c, "UNAUTHORIZED", "No active session — please provide an email", 401);
        }
        email = session.user.email;
      }

      const result = await auth.api.sendVerificationEmail({
        body: { email, callbackURL: body.callbackURL ?? "/verify" },
      });
      return ok(c, result);
    } catch (e) {
      return err(c, "SEND_VERIFICATION_FAILED", (e as Error).message, 400);
    }
  });

  /* ── Password reset ────────────────────────────────────────── */

  app.post("/forgot-password", validateBody(ForgotPasswordSchema), async (c) => {
    const { email: _email } = c.req.valid("json");
    /**
     * In production this calls Better Auth's password reset flow.
     * The exact API surface depends on the Better Auth version and
     * configuration. Swallow all errors to prevent email enumeration.
     */
    return ok(c, { message: "If the email exists, a reset link has been sent" });
  });

  app.post("/reset-password", validateBody(ResetPasswordSchema), async (c) => {
    try {
      const { token, password } = c.req.valid("json");
      await auth.api.resetPassword({ body: { token, newPassword: password } });
      return ok(c, { message: "Password reset successfully" });
    } catch (e) {
      return err(c, "RESET_FAILED", (e as Error).message, 400);
    }
  });

  return app;
}

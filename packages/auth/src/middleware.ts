import type { Context, MiddlewareHandler } from "hono";
import type { AuthInstance } from "./server.js";
import { ROLE_HIERARCHY, checkPermission, type RoleName } from "./permissions.js";

/**
 * Shape of the auth context attached to Hono's request context.
 * Downstream handlers access this via `c.get("auth")`.
 */
export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  orgId: string;
  role: RoleName;
  sessionId: string;
}

/**
 * In-memory sliding-window rate limiter.
 * Keyed by a string identifier (IP, userId, etc.).
 * Not suitable for multi-process deployments — use Redis
 * in production behind a load balancer.
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Extracts the session from the request using Better Auth's
 * header-based session resolution. Returns null when no valid
 * session is present.
 */
async function resolveSession(
  auth: AuthInstance,
  c: Context,
): Promise<AuthContext | null> {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name ?? "",
    orgId: (session.session as Record<string, unknown>)["activeOrganizationId"] as string ?? "",
    role: ((session.session as Record<string, unknown>)["role"] as RoleName) ?? "member",
    sessionId: session.session.id,
  };
}

/**
 * Requires a valid session. Returns 401 if no session exists.
 * Attaches the auth context to the Hono request context.
 */
export function requireAuth(auth: AuthInstance): MiddlewareHandler {
  return async (c, next) => {
    const authCtx = await resolveSession(auth, c);
    if (!authCtx) {
      return c.json({ data: null, error: { code: "UNAUTHORIZED", message: "Authentication required" }, meta: undefined }, 401);
    }
    c.set("auth", authCtx);
    await next();
  };
}

/**
 * Requires the user's role to be at or above the specified level.
 * Must be used after requireAuth() in the middleware chain.
 */
export function requireRole(auth: AuthInstance, role: RoleName): MiddlewareHandler {
  return async (c, next) => {
    const authCtx = await resolveSession(auth, c);
    if (!authCtx) {
      return c.json({ data: null, error: { code: "UNAUTHORIZED", message: "Authentication required" }, meta: undefined }, 401);
    }

    if (!checkPermission(authCtx.role, role)) {
      return c.json({ data: null, error: { code: "FORBIDDEN", message: `Requires ${role} role or higher` }, meta: undefined }, 403);
    }

    c.set("auth", authCtx);
    await next();
  };
}

/**
 * Requires the user to be a member of an organization.
 * Must be used after requireAuth() in the middleware chain.
 */
export function requireOrg(auth: AuthInstance): MiddlewareHandler {
  return async (c, next) => {
    const authCtx = await resolveSession(auth, c);
    if (!authCtx) {
      return c.json({ data: null, error: { code: "UNAUTHORIZED", message: "Authentication required" }, meta: undefined }, 401);
    }

    if (!authCtx.orgId) {
      return c.json({ data: null, error: { code: "NO_ORG", message: "Organization context required" }, meta: undefined }, 403);
    }

    c.set("auth", authCtx);
    await next();
  };
}

/**
 * Attaches user context if a valid session exists, but
 * allows the request to proceed even without authentication.
 * Useful for public endpoints that show extra data to logged-in users.
 */
export function optionalAuth(auth: AuthInstance): MiddlewareHandler {
  return async (c, next) => {
    const authCtx = await resolveSession(auth, c);
    if (authCtx) {
      c.set("auth", authCtx);
    }
    await next();
  };
}

/**
 * Per-key sliding-window rate limiter middleware.
 * Identifies callers by IP address by default.
 *
 * @param windowMs - Time window in milliseconds
 * @param max - Maximum requests per window
 */
export function rateLimiter(limits: {
  windowMs?: number;
  max?: number;
}): MiddlewareHandler {
  const windowMs = limits.windowMs ?? 60_000;
  const max = limits.max ?? 60;

  return async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";

    const now = Date.now();
    const entry = rateLimitStore.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    if (entry.count >= max) {
      c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json(
        { data: null, error: { code: "RATE_LIMITED", message: "Too many requests" }, meta: undefined },
        429,
      );
    }

    entry.count += 1;
    await next();
  };
}

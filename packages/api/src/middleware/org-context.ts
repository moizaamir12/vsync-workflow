import type { MiddlewareHandler } from "hono";

/**
 * Extracts the active organization ID from either the auth context
 * (set by requireAuth/requireOrg middleware in @vsync/auth) or from
 * the X-Org-Id request header as a fallback. Attaches it to the Hono
 * context so downstream handlers can read `c.get("orgId")`.
 *
 * This runs AFTER auth middleware so the session's orgId takes priority.
 */
export function orgContext(): MiddlewareHandler {
  return async (c, next) => {
    /* Auth middleware populates this when the user has an active org */
    const authCtx = c.get("auth") as { orgId?: string } | undefined;
    const orgId = authCtx?.orgId ?? c.req.header("x-org-id") ?? "";

    c.set("orgId", orgId);
    await next();
  };
}

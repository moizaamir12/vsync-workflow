import type { Context } from "hono";

/**
 * Standardised response helpers that enforce the { data, error, meta }
 * envelope shape across every endpoint. Using these instead of raw
 * `c.json()` eliminates envelope inconsistencies.
 */

/** Return a success response with data and optional meta. */
export function ok<T>(c: Context, data: T, meta?: unknown, status: number = 200) {
  return c.json({ data, error: null, meta: meta ?? undefined }, status as 200);
}

/** Return an error response with the correct HTTP status code. */
export function err(c: Context, code: string, message: string, status: number = 400, details?: unknown) {
  return c.json(
    { data: null, error: { code, message, ...(details ? { details } : {}) }, meta: undefined },
    status as 400,
  );
}

/** 404 shorthand. */
export function notFound(c: Context, resource: string = "Resource") {
  return err(c, "NOT_FOUND", `${resource} not found`, 404);
}

/** 409 shorthand. */
export function conflict(c: Context, message: string) {
  return err(c, "CONFLICT", message, 409);
}

/** 403 shorthand. */
export function forbidden(c: Context, message: string = "Access denied") {
  return err(c, "FORBIDDEN", message, 403);
}

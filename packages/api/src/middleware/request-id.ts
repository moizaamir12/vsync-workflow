import type { MiddlewareHandler } from "hono";
import { nanoid } from "nanoid";

/**
 * Generates a unique request ID for every inbound request.
 * The ID is attached to the Hono context and echoed back
 * in the X-Request-Id response header so callers can
 * correlate logs across services.
 */
export function requestId(): MiddlewareHandler {
  return async (c, next) => {
    const id = c.req.header("x-request-id") ?? nanoid();
    c.set("requestId", id);
    c.header("X-Request-Id", id);
    await next();
  };
}

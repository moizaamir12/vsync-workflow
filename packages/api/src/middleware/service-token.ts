import type { MiddlewareHandler } from "hono";

/**
 * Validates the X-Service-Token header against the ENGINE_SERVICE_TOKEN
 * env var. Used to protect internal endpoints that the workflow engine
 * calls (e.g. key resolution) without requiring a user JWT.
 */
export function requireServiceToken(): MiddlewareHandler {
  return async (c, next) => {
    const expected = process.env["ENGINE_SERVICE_TOKEN"];
    if (!expected) {
      return c.json(
        {
          data: null,
          error: { code: "SERVER_ERROR", message: "Service token not configured" },
          meta: undefined,
        },
        500,
      );
    }

    const token = c.req.header("x-service-token");
    if (token !== expected) {
      return c.json(
        {
          data: null,
          error: { code: "UNAUTHORIZED", message: "Invalid service token" },
          meta: undefined,
        },
        401,
      );
    }

    await next();
  };
}

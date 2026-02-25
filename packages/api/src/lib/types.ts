import type { AuthContext } from "@vsync/auth";

/**
 * Hono environment type that registers all custom context
 * variables used by our middleware chain. Every Hono instance
 * created with `new Hono<AppEnv>()` will type-check `c.get()`
 * and `c.set()` calls.
 */
export interface AppEnv {
  Variables: {
    auth: AuthContext;
    requestId: string;
    orgId: string;
  };
}

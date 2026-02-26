import { Hono } from "hono";
import { z } from "zod";
import type { AuthInstance } from "@vsync/auth";
import { requireAuth, requireOrg } from "@vsync/auth";
import type { Database } from "@vsync/db";
import { CacheRepository } from "@vsync/db";
import { validateBody, validateParams } from "../middleware/validate.js";
import { orgContext } from "../middleware/org-context.js";
import { ok, notFound } from "../lib/response.js";
import type { AppEnv } from "../lib/types.js";

const KeyParam = z.object({ key: z.string().min(1) });

const SetCacheSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.unknown(),
});

export function cacheRoutes(auth: AuthInstance, db: Database) {
  const app = new Hono<AppEnv>();
  const repo = new CacheRepository(db);

  /* ── Get cache value ───────────────────────────────────────── */

  app.get("/:key", requireAuth(auth), requireOrg(auth), orgContext(), validateParams(KeyParam), async (c) => {
    const authCtx = c.get("auth");
    const { key } = c.req.valid("param");

    const value = await repo.get(key, authCtx.orgId);
    if (value === null) return notFound(c, "Cache entry");
    return ok(c, { key, value });
  });

  /* ── Set cache value ───────────────────────────────────────── */

  app.post("/", requireAuth(auth), requireOrg(auth), orgContext(), validateBody(SetCacheSchema), async (c) => {
    const authCtx = c.get("auth");
    const { key, value } = c.req.valid("json");

    await repo.set(key, authCtx.orgId, value);
    return ok(c, { key, value }, undefined, 201);
  });

  /* ── Delete cache key ──────────────────────────────────────── */

  app.delete("/:key", requireAuth(auth), requireOrg(auth), orgContext(), validateParams(KeyParam), async (c) => {
    const authCtx = c.get("auth");
    const { key } = c.req.valid("param");

    await repo.delete(key, authCtx.orgId);
    return ok(c, { message: "Cache entry deleted" });
  });

  /* ── Clear org cache ───────────────────────────────────────── */

  // TODO(validation): Validate request body before processing cache deletion.
  app.delete("/", requireAuth(auth), requireOrg(auth), orgContext(), async (c) => {
    const authCtx = c.get("auth");
    await repo.clearOrg(authCtx.orgId);
    return ok(c, { message: "Organization cache cleared" });
  });

  return app;
}

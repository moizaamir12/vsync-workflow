import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, and } from "drizzle-orm";
import type { AuthInstance } from "@vsync/auth";
import { requireAuth, requireOrg } from "@vsync/auth";
import type { Database } from "@vsync/db";
import { devices } from "@vsync/db";
import { validateBody, validateParams } from "../middleware/validate.js";
import { orgContext } from "../middleware/org-context.js";
import { ok, notFound } from "../lib/response.js";
import type { AppEnv } from "../lib/types.js";

const IdParam = z.object({ id: z.string().min(1) });

const RegisterDeviceSchema = z.object({
  hardwareId: z.string().min(1),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(100).optional(),
  platform: z.string().optional(),
  arch: z.string().optional(),
  executionEnvironment: z.enum(["desktop", "mobile", "kiosk", "cloud"]).default("desktop"),
  tags: z.record(z.unknown()).optional(),
  cpuCores: z.number().int().optional(),
  memoryGb: z.number().optional(),
  diskGb: z.number().optional(),
});

const UpdateDeviceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  platform: z.string().optional(),
  arch: z.string().optional(),
  tags: z.record(z.unknown()).optional(),
  cpuCores: z.number().int().optional(),
  memoryGb: z.number().optional(),
  diskGb: z.number().optional(),
});

export function deviceRoutes(auth: AuthInstance, db: Database) {
  const app = new Hono<AppEnv>();

  /* ── Register device ───────────────────────────────────────── */

  app.post("/", requireAuth(auth), requireOrg(auth), orgContext(), validateBody(RegisterDeviceSchema), async (c) => {
    const authCtx = c.get("auth");
    const body = c.req.valid("json");

    const [device] = await db
      .insert(devices)
      .values({
        id: nanoid(),
        orgId: authCtx.orgId,
        hardwareId: body.hardwareId,
        name: body.name,
        slug: body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        platform: body.platform ?? null,
        arch: body.arch ?? null,
        executionEnvironment: body.executionEnvironment,
        tags: body.tags ?? null,
        cpuCores: body.cpuCores ?? null,
        memoryGb: body.memoryGb ?? null,
        diskGb: body.diskGb ?? null,
        lastSeenAt: new Date(),
      })
      .returning();

    return ok(c, device, undefined, 201);
  });

  /* ── List devices ──────────────────────────────────────────── */

  app.get("/", requireAuth(auth), requireOrg(auth), orgContext(), async (c) => {
    const authCtx = c.get("auth");

    const rows = await db.query.devices.findMany({
      where: eq(devices.orgId, authCtx.orgId),
    });

    return ok(c, rows);
  });

  /* ── Get device ────────────────────────────────────────────── */

  app.get("/:id", requireAuth(auth), requireOrg(auth), orgContext(), validateParams(IdParam), async (c) => {
    const authCtx = c.get("auth");
    const { id } = c.req.valid("param");
    const device = await db.query.devices.findFirst({
      where: and(eq(devices.id, id), eq(devices.orgId, authCtx.orgId)),
    });
    if (!device) return notFound(c, "Device");
    return ok(c, device);
  });

  /* ── Update device ─────────────────────────────────────────── */

  app.patch("/:id", requireAuth(auth), orgContext(), validateParams(IdParam), validateBody(UpdateDeviceSchema), async (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");

    const [updated] = await db
      .update(devices)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(devices.id, id))
      .returning();

    if (!updated) return notFound(c, "Device");
    return ok(c, updated);
  });

  /* ── Delete device ─────────────────────────────────────────── */

  app.delete("/:id", requireAuth(auth), orgContext(), validateParams(IdParam), async (c) => {
    const { id } = c.req.valid("param");
    await db.delete(devices).where(eq(devices.id, id));
    return ok(c, { message: "Device deleted" });
  });

  /* ── Device heartbeat ──────────────────────────────────────── */

  app.post("/:id/heartbeat", requireAuth(auth), validateParams(IdParam), async (c) => {
    const { id } = c.req.valid("param");

    const [updated] = await db
      .update(devices)
      .set({ lastSeenAt: new Date() })
      .where(eq(devices.id, id))
      .returning();

    if (!updated) return notFound(c, "Device");
    return ok(c, { lastSeenAt: updated.lastSeenAt });
  });

  return app;
}

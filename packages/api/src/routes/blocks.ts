import { Hono } from "hono";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, and, asc } from "drizzle-orm";
import type { AuthInstance } from "@vsync/auth";
import { requireAuth, requireOrg } from "@vsync/auth";
import type { Database } from "@vsync/db";
import { blocks as blocksTable } from "@vsync/db";
import { validateBody, validateParams } from "../middleware/validate.js";
import { orgContext } from "../middleware/org-context.js";
import { ok, notFound, err } from "../lib/response.js";
import type { AppEnv } from "../lib/types.js";

const VersionParam = z.object({
  wid: z.string().min(1),
  v: z.string().regex(/^\d+$/),
});

const BlockIdParam = z.object({ id: z.string().min(1) });

const CreateBlockSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().min(1),
  logic: z.record(z.unknown()).default({}),
  conditions: z.record(z.unknown()).optional(),
  order: z.number().int().min(0),
  notes: z.string().max(2000).optional(),
});

const UpdateBlockSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  type: z.string().min(1).optional(),
  logic: z.record(z.unknown()).optional(),
  conditions: z.record(z.unknown()).optional(),
  order: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

const ReorderSchema = z.object({
  /** Array of block IDs in the desired order. */
  blockIds: z.array(z.string().min(1)).min(1),
});

export function blockRoutes(auth: AuthInstance, db: Database) {
  const app = new Hono<AppEnv>();

  /* ── Create block ──────────────────────────────────────────── */

  app.post(
    "/workflows/:wid/versions/:v/blocks",
    requireAuth(auth),
    requireOrg(auth),
    orgContext(),
    validateParams(VersionParam),
    validateBody(CreateBlockSchema),
    async (c) => {
      const { wid, v } = c.req.valid("param");
      const body = c.req.valid("json");

      const [block] = await db
        .insert(blocksTable)
        .values({
          id: nanoid(),
          workflowId: wid,
          workflowVersion: parseInt(v, 10),
          name: body.name,
          type: body.type,
          logic: body.logic,
          conditions: body.conditions ?? null,
          order: body.order,
          notes: body.notes ?? null,
        })
        .returning();

      return ok(c, block, undefined, 201);
    },
  );

  /* ── List blocks (ordered) ─────────────────────────────────── */

  app.get(
    "/workflows/:wid/versions/:v/blocks",
    requireAuth(auth),
    validateParams(VersionParam),
    async (c) => {
      const { wid, v } = c.req.valid("param");

      const rows = await db.query.blocks.findMany({
        where: and(
          eq(blocksTable.workflowId, wid),
          eq(blocksTable.workflowVersion, parseInt(v, 10)),
        ),
        orderBy: asc(blocksTable.order),
      });

      return ok(c, rows);
    },
  );

  /* ── Update block ──────────────────────────────────────────── */

  app.patch(
    "/blocks/:id",
    requireAuth(auth),
    orgContext(),
    validateParams(BlockIdParam),
    validateBody(UpdateBlockSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");

      const [updated] = await db
        .update(blocksTable)
        .set({ ...body, updatedAt: new Date() })
        .where(eq(blocksTable.id, id))
        .returning();

      if (!updated) return notFound(c, "Block");
      return ok(c, updated);
    },
  );

  /* ── Delete block ──────────────────────────────────────────── */

  app.delete(
    "/blocks/:id",
    requireAuth(auth),
    orgContext(),
    validateParams(BlockIdParam),
    async (c) => {
      const { id } = c.req.valid("param");

      await db.delete(blocksTable).where(eq(blocksTable.id, id));
      return ok(c, { message: "Block deleted" });
    },
  );

  /* ── Reorder blocks ────────────────────────────────────────── */

  app.post(
    "/workflows/:wid/versions/:v/blocks/reorder",
    requireAuth(auth),
    orgContext(),
    validateParams(VersionParam),
    validateBody(ReorderSchema),
    async (c) => {
      const { blockIds } = c.req.valid("json");

      try {
        await db.transaction(async (tx) => {
          for (let i = 0; i < blockIds.length; i++) {
            await tx
              .update(blocksTable)
              .set({ order: i, updatedAt: new Date() })
              .where(eq(blocksTable.id, blockIds[i]));
          }
        });
        return ok(c, { message: "Blocks reordered" });
      } catch (e) {
        return err(c, "REORDER_FAILED", (e as Error).message, 400);
      }
    },
  );

  return app;
}

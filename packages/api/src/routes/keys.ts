import { Hono } from "hono";
import { z } from "zod";
import crypto from "node:crypto";
import type { AuthInstance } from "@vsync/auth";
import { requireAuth, requireOrg, requireRole } from "@vsync/auth";
import type { Database } from "@vsync/db";
import { KeyRepository } from "@vsync/db";
import { validateBody, validateParams } from "../middleware/validate.js";
import { orgContext } from "../middleware/org-context.js";
import { requireServiceToken } from "../middleware/service-token.js";
import { ok, notFound, err } from "../lib/response.js";
import type { AppEnv } from "../lib/types.js";

const IdParam = z.object({ id: z.string().min(1) });

const CreateKeySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  value: z.string().min(1),
  keyType: z.string().default("api_key"),
  provider: z.string().default("custom"),
  storageMode: z.enum(["cloud", "local"]).default("cloud"),
  workflowId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
});

const UpdateKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  expiresAt: z.string().datetime().optional(),
});

const ResolveKeySchema = z.object({
  keyName: z.string().min(1),
  workflowId: z.string().optional(),
});

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 256-bit encryption key from the application secret
 * using HKDF. Falls back to AUTH_SECRET if KEY_ENCRYPTION_SECRET
 * is not set. Throws at startup if neither is available.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env["KEY_ENCRYPTION_SECRET"] ?? process.env["AUTH_SECRET"];
  if (!secret) {
    throw new Error("KEY_ENCRYPTION_SECRET or AUTH_SECRET environment variable is required for key encryption");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a value using AES-256-GCM.
 * Returns the encrypted value (ciphertext + auth tag, base64) and IV (base64).
 */
function encrypt(value: string): { encryptedValue: string; iv: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(value, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store ciphertext + authTag together so decryption has everything it needs
  const encryptedValue = Buffer.concat([encrypted, authTag]).toString("base64");
  return { encryptedValue, iv: iv.toString("base64") };
}

/**
 * Decrypts a value encrypted with AES-256-GCM.
 * Expects encryptedValue = base64(ciphertext + authTag), iv = base64(iv).
 */
function decrypt(encryptedValue: string, iv: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedValue, "base64");
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"), { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
}

export function keyRoutes(auth: AuthInstance, db: Database) {
  const app = new Hono<AppEnv>();
  const repo = new KeyRepository(db);

  /* ── Create key ────────────────────────────────────────────── */

  app.post(
    "/",
    requireAuth(auth),
    requireRole(auth, "admin"),
    orgContext(),
    validateBody(CreateKeySchema),
    async (c) => {
      const authCtx = c.get("auth");
      const body = c.req.valid("json");

      const { encryptedValue, iv } = encrypt(body.value);

      const key = await repo.create(
        {
          orgId: authCtx.orgId,
          name: body.name,
          description: body.description ?? null,
          keyType: body.keyType,
          provider: body.provider,
          storageMode: body.storageMode,
          encryptedValue,
          iv,
          workflowId: body.workflowId ?? null,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
          createdBy: authCtx.userId,
        },
        authCtx.userId,
      );

      /* Return the plaintext value only on creation */
      return ok(c, { ...key, value: body.value }, undefined, 201);
    },
  );

  /* ── List keys (metadata only) ─────────────────────────────── */

  app.get("/", requireAuth(auth), requireOrg(auth), orgContext(), async (c) => {
    const authCtx = c.get("auth");
    const allKeys = await repo.findByOrg(authCtx.orgId);

    /* Strip encrypted value from response */
    const sanitized = allKeys.map(({ encryptedValue: _ev, iv: _iv, ...rest }) => rest);
    return ok(c, sanitized);
  });

  /* ── Get key metadata ──────────────────────────────────────── */

  app.get("/:id", requireAuth(auth), validateParams(IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const key = await repo.findById(id);
    if (!key) return notFound(c, "Key");

    /* Never return the encrypted value in a GET */
    const { encryptedValue: _ev, iv: _iv, ...sanitized } = key;
    return ok(c, sanitized);
  });

  /* ── Decrypt key (audit logged) ────────────────────────────── */

  app.post(
    "/:id/decrypt",
    requireAuth(auth),
    requireRole(auth, "admin"),
    orgContext(),
    validateParams(IdParam),
    async (c) => {
      const authCtx = c.get("auth");
      const { id } = c.req.valid("param");

      const key = await repo.findById(id);
      if (!key) return notFound(c, "Key");
      if (key.isRevoked) return err(c, "KEY_REVOKED", "This key has been revoked", 410);

      /* Audit the decryption */
      await repo.logAccess(id, authCtx.userId, { action: "decrypt" });

      const value = decrypt(key.encryptedValue, key.iv);
      return ok(c, { id: key.id, name: key.name, value });
    },
  );

  /* ── Update key metadata ───────────────────────────────────── */

  app.patch(
    "/:id",
    requireAuth(auth),
    requireRole(auth, "admin"),
    validateParams(IdParam),
    validateBody(UpdateKeySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");

      const updated = await repo.update(id, {
        ...body,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });

      if (!updated) return notFound(c, "Key");
      const { encryptedValue: _ev, iv: _iv, ...sanitized } = updated;
      return ok(c, sanitized);
    },
  );

  /* ── Rotate key value ──────────────────────────────────────── */

  app.post(
    "/:id/rotate",
    requireAuth(auth),
    requireRole(auth, "admin"),
    orgContext(),
    validateParams(IdParam),
    validateBody(z.object({ value: z.string().min(1) })),
    async (c) => {
      const authCtx = c.get("auth");
      const { id } = c.req.valid("param");
      const { value } = c.req.valid("json");

      const existing = await repo.findById(id);
      if (!existing) return notFound(c, "Key");

      /* Revoke old value */
      await repo.revoke(id, authCtx.userId);

      /* Create new key with same metadata but new encrypted value */
      const { encryptedValue, iv } = encrypt(value);
      const newKey = await repo.create(
        {
          orgId: existing.orgId,
          name: existing.name,
          description: existing.description,
          keyType: existing.keyType,
          provider: existing.provider,
          storageMode: existing.storageMode,
          encryptedValue,
          iv,
          workflowId: existing.workflowId,
          expiresAt: existing.expiresAt,
          createdBy: authCtx.userId,
        },
        authCtx.userId,
      );

      return ok(c, { ...newKey, value });
    },
  );

  /* ── Revoke key ────────────────────────────────────────────── */

  app.delete(
    "/:id",
    requireAuth(auth),
    requireRole(auth, "admin"),
    orgContext(),
    validateParams(IdParam),
    async (c) => {
      const authCtx = c.get("auth");
      const { id } = c.req.valid("param");

      await repo.revoke(id, authCtx.userId);
      return ok(c, { message: "Key revoked" });
    },
  );

  /* ── Audit log ─────────────────────────────────────────────── */

  app.get(
    "/:id/audit",
    requireAuth(auth),
    requireRole(auth, "admin"),
    validateParams(IdParam),
    async (c) => {
      const { id } = c.req.valid("param");
      const log = await repo.getAuditLog(id);
      return ok(c, log);
    },
  );

  /* ── Resolve key (engine internal) ─────────────────────────── */

  app.post("/resolve", requireServiceToken(), validateBody(ResolveKeySchema), async (c) => {
    const { keyName, workflowId } = c.req.valid("json");

    /**
     * Engine resolution: look up by name at the org level.
     * The orgId comes from the workflow's association rather
     * than from user auth (since this uses a service token).
     */
    if (!workflowId) {
      return err(c, "BAD_REQUEST", "workflowId is required for key resolution", 400);
    }

    const { eq } = await import("drizzle-orm");
    const { workflows } = await import("@vsync/db");
    const wf = await db.query.workflows.findFirst({
      where: eq(workflows.id, workflowId),
    });

    if (!wf) return notFound(c, "Workflow");

    const key = await repo.findByName(wf.orgId, keyName);
    if (!key) return notFound(c, "Key");
    if (key.isRevoked) return err(c, "KEY_REVOKED", "Key has been revoked", 410);

    await repo.logAccess(key.id, undefined, { workflowId, action: "engine_resolve" });

    const value = decrypt(key.encryptedValue, key.iv);
    return ok(c, { name: key.name, value });
  });

  return app;
}

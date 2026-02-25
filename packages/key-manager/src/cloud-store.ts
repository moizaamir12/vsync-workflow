import { nanoid } from "nanoid";
import type { Database } from "@vsync/db";
import { KeyRepository } from "@vsync/db";
import { encrypt, decrypt } from "./crypto.js";
import type {
  CreateKeyOpts,
  DecryptedKey,
  KeyMetadata,
  AuditEntry,
  KeyType,
  Provider,
  StorageMode,
} from "./types.js";

/**
 * Cloud key storage backed by PostgreSQL via @vsync/db.
 *
 * All secret values are encrypted with AES-256-GCM before they
 * reach the database. The master key NEVER leaves this process —
 * it's held in memory and sourced from the ENCRYPTION_MASTER_KEY
 * env var (or a KMS in production).
 *
 * Every state-changing operation is logged in the key_audit_log
 * table for compliance and forensics.
 */
export class CloudKeyStore {
  private readonly repo: KeyRepository;

  constructor(
    private readonly db: Database,
    private readonly masterKey: string,
  ) {
    this.repo = new KeyRepository(db);
  }

  /* ── Create ──────────────────────────────────────────────── */

  /**
   * Encrypt and store a new key.
   *
   * Validates name uniqueness per org (and per org+workflow
   * if workflowId is provided). Returns the full key record
   * WITHOUT the decrypted value — callers who need the plaintext
   * should use getKey() separately.
   */
  async createKey(opts: CreateKeyOpts, performedBy?: string): Promise<KeyMetadata> {
    /* Check for duplicate name within the scope */
    const existing = opts.workflowId
      ? await this.findWorkflowKey(opts.orgId, opts.name, opts.workflowId)
      : await this.repo.findByName(opts.orgId, opts.name);

    if (existing) {
      throw new Error(`Key "${opts.name}" already exists in this scope`);
    }

    const { ciphertext, iv } = encrypt(opts.value, this.masterKey);

    const row = await this.repo.create(
      {
        id: nanoid(),
        orgId: opts.orgId,
        workflowId: opts.workflowId ?? null,
        name: opts.name,
        description: opts.description ?? null,
        provider: opts.provider,
        keyType: opts.keyType,
        encryptedValue: ciphertext,
        iv,
        algorithm: "aes-256-gcm",
        storageMode: opts.storageMode,
        expiresAt: opts.expiresAt ?? null,
        isRevoked: false,
      },
      performedBy,
    );

    return this.toMetadata(row);
  }

  /* ── Read ────────────────────────────────────────────────── */

  /**
   * Retrieve and decrypt a key by name within an org.
   *
   * Resolution order when workflowId is provided:
   *   1. Workflow-scoped key (orgId + workflowId + name)
   *   2. Org-wide key (orgId + name, workflowId is null)
   *
   * Returns null if not found, revoked, or expired.
   */
  async getKey(
    orgId: string,
    name: string,
    workflowId?: string,
    performedBy?: string,
  ): Promise<DecryptedKey | null> {
    let row: Awaited<ReturnType<KeyRepository["findByName"]>> = undefined;

    /* Try workflow-scoped first, then fall back to org-wide */
    if (workflowId) {
      row = await this.findWorkflowKey(orgId, name, workflowId);
    }
    if (!row) {
      row = await this.repo.findByName(orgId, name);
    }
    if (!row) return null;

    /* Guard against revoked or expired keys */
    if (row.isRevoked) return null;
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) return null;

    /* Log the access event */
    await this.repo.logAccess(row.id, performedBy);

    const value = decrypt(row.encryptedValue, row.iv, this.masterKey);

    return {
      ...this.toMetadata(row),
      value,
    };
  }

  /* ── List ────────────────────────────────────────────────── */

  /**
   * List key metadata for an org, optionally filtered by workflow.
   * NEVER returns decrypted values — safe for dashboards.
   */
  async listKeys(orgId: string, workflowId?: string): Promise<KeyMetadata[]> {
    const rows = workflowId
      ? await this.repo.findByWorkflow(workflowId)
      : await this.repo.findByOrg(orgId);

    return rows.map((r) => this.toMetadata(r));
  }

  /* ── Rotate ──────────────────────────────────────────────── */

  /**
   * Replace a key's encrypted value with a new plaintext.
   *
   * The old value is not recoverable after rotation — the audit
   * log records that a rotation occurred but NOT the old value.
   */
  async rotateKey(keyId: string, newValue: string, performedBy?: string): Promise<void> {
    const key = await this.repo.findById(keyId);
    if (!key) throw new Error("Key not found");
    if (key.isRevoked) throw new Error("Cannot rotate a revoked key");

    const { ciphertext, iv } = encrypt(newValue, this.masterKey);

    await this.repo.update(keyId, {
      encryptedValue: ciphertext,
      iv,
      lastRotatedAt: new Date(),
    });

    /* Audit log the rotation */
    await this.logAudit(keyId, "rotated", performedBy);
  }

  /* ── Revoke ──────────────────────────────────────────────── */

  /**
   * Soft-revoke a key. The encrypted data remains in the DB
   * for audit purposes but getKey() will return null.
   */
  async revokeKey(keyId: string, performedBy?: string): Promise<void> {
    await this.repo.revoke(keyId, performedBy);
  }

  /* ── Audit ───────────────────────────────────────────────── */

  /** Retrieve the audit trail for a key, newest first. */
  async getAuditLog(keyId: string, limit?: number): Promise<AuditEntry[]> {
    const rows = await this.repo.getAuditLog(keyId);
    const entries = rows.map((r) => ({
      id: r.id,
      keyId: r.keyId,
      action: r.action as AuditEntry["action"],
      performedBy: r.performedBy,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      metadata: r.metadata as Record<string, unknown> | null,
      createdAt: r.createdAt,
    }));

    return limit ? entries.slice(0, limit) : entries;
  }

  /* ── Internal helpers ────────────────────────────────────── */

  /**
   * Find a workflow-scoped key. Uses the repo's generic query
   * since findByName only handles org-wide (null workflowId).
   */
  private async findWorkflowKey(
    orgId: string,
    name: string,
    workflowId: string,
  ) {
    const wfKeys = await this.repo.findByWorkflow(workflowId);
    return wfKeys.find(
      (k) => k.orgId === orgId && k.name === name,
    );
  }

  /** Map a DB row to the public KeyMetadata shape. */
  private toMetadata(row: NonNullable<Awaited<ReturnType<KeyRepository["findById"]>>>): KeyMetadata {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      keyType: row.keyType as KeyType,
      provider: row.provider as Provider,
      storageMode: (row.storageMode ?? "cloud") as StorageMode,
      workflowId: row.workflowId,
      lastUsedAt: row.lastUsedAt,
      expiresAt: row.expiresAt,
      isRevoked: row.isRevoked ?? false,
      createdAt: row.createdAt,
    };
  }

  /** Write an audit log entry for operations not handled by the repo. */
  private async logAudit(keyId: string, action: string, performedBy?: string): Promise<void> {
    const { keyAuditLog } = await import("@vsync/db");
    await this.db.insert(keyAuditLog).values({
      keyId,
      action,
      performedBy: performedBy ?? null,
    });
  }
}

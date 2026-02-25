import { eq, and, desc, isNull } from "drizzle-orm";
import { keys, keyAuditLog } from "../schema/index.js";
import type { Database } from "../client.js";

/**
 * Provides CRUD, revocation, and audit operations for API keys.
 * All state-changing operations that need an audit trail use
 * transactions to guarantee the log entry is atomic with the change.
 */
export class KeyRepository {
  constructor(private readonly db: Database) {}

  /** Insert a new key and log the creation event. */
  async create(
    data: typeof keys.$inferInsert,
    performedBy?: string,
  ) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx.insert(keys).values(data).returning();

      await tx.insert(keyAuditLog).values({
        keyId: row.id,
        action: "created",
        performedBy,
      });

      return row;
    });
  }

  /** Retrieve a key by primary key. */
  async findById(id: string) {
    return this.db.query.keys.findFirst({
      where: eq(keys.id, id),
    });
  }

  /** List all keys for an organization. */
  async findByOrg(orgId: string) {
    return this.db.query.keys.findMany({
      where: eq(keys.orgId, orgId),
      orderBy: desc(keys.createdAt),
    });
  }

  /** List keys scoped to a specific workflow. */
  async findByWorkflow(workflowId: string) {
    return this.db.query.keys.findMany({
      where: eq(keys.workflowId, workflowId),
      orderBy: desc(keys.createdAt),
    });
  }

  /**
   * Find an org-wide key by name (workflowId is null).
   * Used to resolve keys by human-readable name at runtime.
   */
  async findByName(orgId: string, name: string) {
    return this.db.query.keys.findFirst({
      where: and(
        eq(keys.orgId, orgId),
        eq(keys.name, name),
        isNull(keys.workflowId),
      ),
    });
  }

  /** Partial update of key metadata. */
  async update(id: string, data: Partial<typeof keys.$inferInsert>) {
    const [row] = await this.db
      .update(keys)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(keys.id, id))
      .returning();
    return row;
  }

  /** Soft-revoke a key and log the event. */
  async revoke(id: string, performedBy?: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .update(keys)
        .set({ isRevoked: true, updatedAt: new Date() })
        .where(eq(keys.id, id))
        .returning();

      await tx.insert(keyAuditLog).values({
        keyId: id,
        action: "revoked",
        performedBy,
      });

      return row;
    });
  }

  /** Hard-delete a key (cascade deletes audit log). */
  async delete(id: string) {
    await this.db.delete(keys).where(eq(keys.id, id));
  }

  /** Record a key-access event (e.g. decrypted for use in a run). */
  async logAccess(keyId: string, performedBy?: string, meta?: Record<string, unknown>) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(keys)
        .set({ lastUsedAt: new Date() })
        .where(eq(keys.id, keyId));

      await tx.insert(keyAuditLog).values({
        keyId,
        action: "accessed",
        performedBy,
        metadata: meta,
      });
    });
  }

  /** Retrieve the audit trail for a key, newest first. */
  async getAuditLog(keyId: string) {
    return this.db.query.keyAuditLog.findMany({
      where: eq(keyAuditLog.keyId, keyId),
      orderBy: desc(keyAuditLog.createdAt),
    });
  }
}

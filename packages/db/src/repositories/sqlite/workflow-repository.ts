import { eq, and, desc } from "drizzle-orm";
import {
  sqliteWorkflows,
  sqliteWorkflowVersions,
  sqliteBlocks,
} from "../../schema/sqlite.js";
import type { SqliteDatabase } from "../../sqlite-client.js";

/**
 * SQLite-backed workflow repository — same API surface as the PG version.
 * All multi-table mutations use transactions for atomicity.
 */
export class SqliteWorkflowRepository {
  constructor(private readonly db: SqliteDatabase) {}

  /** Insert a new workflow row. */
  async create(data: typeof sqliteWorkflows.$inferInsert) {
    const [row] = await this.db.insert(sqliteWorkflows).values(data).returning();
    return row;
  }

  /** Retrieve a single workflow by ID. */
  async findById(id: string) {
    return this.db.query.sqliteWorkflows.findFirst({
      where: eq(sqliteWorkflows.id, id),
    });
  }

  /** List all workflows belonging to an organization. */
  async findByOrg(orgId: string) {
    return this.db.query.sqliteWorkflows.findMany({
      where: eq(sqliteWorkflows.orgId, orgId),
      orderBy: desc(sqliteWorkflows.updatedAt),
    });
  }

  /** Partial update of a workflow's mutable fields. */
  async update(id: string, data: Partial<typeof sqliteWorkflows.$inferInsert>) {
    const [row] = await this.db
      .update(sqliteWorkflows)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sqliteWorkflows.id, id))
      .returning();
    return row;
  }

  /** Hard-delete a workflow and all cascading children. */
  async delete(id: string) {
    await this.db.delete(sqliteWorkflows).where(eq(sqliteWorkflows.id, id));
  }

  /**
   * Creates a new version with its blocks in a single transaction.
   * Callers pass the version metadata and an array of block inserts.
   */
  async createVersion(
    versionData: typeof sqliteWorkflowVersions.$inferInsert,
    blockData: (typeof sqliteBlocks.$inferInsert)[],
  ) {
    return this.db.transaction(async (tx) => {
      const [version] = await tx
        .insert(sqliteWorkflowVersions)
        .values(versionData)
        .returning();

      let insertedBlocks: (typeof sqliteBlocks.$inferSelect)[] = [];
      if (blockData.length > 0) {
        insertedBlocks = await tx
          .insert(sqliteBlocks)
          .values(blockData)
          .returning();
      }

      return { version, blocks: insertedBlocks };
    });
  }

  /** List all versions for a workflow, newest first. */
  async findVersions(workflowId: string) {
    return this.db.query.sqliteWorkflowVersions.findMany({
      where: eq(sqliteWorkflowVersions.workflowId, workflowId),
      orderBy: desc(sqliteWorkflowVersions.version),
    });
  }

  /** Get the currently active (published) version and its blocks. */
  async getActiveVersion(workflowId: string) {
    const workflow = await this.findById(workflowId);
    if (!workflow?.activeVersion) return undefined;

    const version = await this.db.query.sqliteWorkflowVersions.findFirst({
      where: and(
        eq(sqliteWorkflowVersions.workflowId, workflowId),
        eq(sqliteWorkflowVersions.version, workflow.activeVersion),
      ),
    });

    if (!version) return undefined;

    const versionBlocks = await this.db.query.sqliteBlocks.findMany({
      where: and(
        eq(sqliteBlocks.workflowId, workflowId),
        eq(sqliteBlocks.workflowVersion, version.version),
      ),
      orderBy: sqliteBlocks.order,
    });

    return { version, blocks: versionBlocks };
  }

  /** Retrieve a workflow by its public slug (for unauthenticated access). */
  async findByPublicSlug(slug: string) {
    return this.db.query.sqliteWorkflows.findFirst({
      where: and(
        eq(sqliteWorkflows.publicSlug, slug),
        eq(sqliteWorkflows.isPublic, true),
      ),
    });
  }

  /**
   * Marks a version as published and updates the workflow's activeVersion.
   * Atomic — both writes succeed or neither does.
   */
  async publishVersion(workflowId: string, version: number) {
    return this.db.transaction(async (tx) => {
      await tx
        .update(sqliteWorkflowVersions)
        .set({ status: "published", updatedAt: new Date() })
        .where(
          and(
            eq(sqliteWorkflowVersions.workflowId, workflowId),
            eq(sqliteWorkflowVersions.version, version),
          ),
        );

      const [updated] = await tx
        .update(sqliteWorkflows)
        .set({ activeVersion: version, updatedAt: new Date() })
        .where(eq(sqliteWorkflows.id, workflowId))
        .returning();

      return updated;
    });
  }
}

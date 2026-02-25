import { eq, and, desc } from "drizzle-orm";
import {
  workflows,
  workflowVersions,
  blocks,
} from "../schema/index.js";
import type { Database } from "../client.js";

/**
 * Provides CRUD and versioning operations for workflows.
 * All multi-table mutations use transactions for atomicity.
 */
export class WorkflowRepository {
  constructor(private readonly db: Database) {}

  /** Insert a new workflow row. */
  async create(data: typeof workflows.$inferInsert) {
    const [row] = await this.db.insert(workflows).values(data).returning();
    return row;
  }

  /** Retrieve a single workflow by ID. */
  async findById(id: string) {
    return this.db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });
  }

  /** List all workflows belonging to an organization. */
  async findByOrg(orgId: string) {
    return this.db.query.workflows.findMany({
      where: eq(workflows.orgId, orgId),
      orderBy: desc(workflows.updatedAt),
    });
  }

  /** Partial update of a workflow's mutable fields. */
  async update(id: string, data: Partial<typeof workflows.$inferInsert>) {
    const [row] = await this.db
      .update(workflows)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return row;
  }

  /** Hard-delete a workflow and all cascading children. */
  async delete(id: string) {
    await this.db.delete(workflows).where(eq(workflows.id, id));
  }

  /**
   * Creates a new version with its blocks in a single transaction.
   * Callers pass the version metadata and an array of block inserts.
   */
  async createVersion(
    versionData: typeof workflowVersions.$inferInsert,
    blockData: (typeof blocks.$inferInsert)[],
  ) {
    return this.db.transaction(async (tx) => {
      const [version] = await tx
        .insert(workflowVersions)
        .values(versionData)
        .returning();

      let insertedBlocks: (typeof blocks.$inferSelect)[] = [];
      if (blockData.length > 0) {
        insertedBlocks = await tx
          .insert(blocks)
          .values(blockData)
          .returning();
      }

      return { version, blocks: insertedBlocks };
    });
  }

  /** List all versions for a workflow, newest first. */
  async findVersions(workflowId: string) {
    return this.db.query.workflowVersions.findMany({
      where: eq(workflowVersions.workflowId, workflowId),
      orderBy: desc(workflowVersions.version),
    });
  }

  /** Get the currently active (published) version and its blocks. */
  async getActiveVersion(workflowId: string) {
    const workflow = await this.findById(workflowId);
    if (!workflow?.activeVersion) return undefined;

    const version = await this.db.query.workflowVersions.findFirst({
      where: and(
        eq(workflowVersions.workflowId, workflowId),
        eq(workflowVersions.version, workflow.activeVersion),
      ),
    });

    if (!version) return undefined;

    const versionBlocks = await this.db.query.blocks.findMany({
      where: and(
        eq(blocks.workflowId, workflowId),
        eq(blocks.workflowVersion, version.version),
      ),
      orderBy: blocks.order,
    });

    return { version, blocks: versionBlocks };
  }

  /** Retrieve a workflow by its public slug (for unauthenticated access). */
  async findByPublicSlug(slug: string) {
    return this.db.query.workflows.findFirst({
      where: and(
        eq(workflows.publicSlug, slug),
        eq(workflows.isPublic, true),
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
        .update(workflowVersions)
        .set({ status: "published", updatedAt: new Date() })
        .where(
          and(
            eq(workflowVersions.workflowId, workflowId),
            eq(workflowVersions.version, version),
          ),
        );

      const [updated] = await tx
        .update(workflows)
        .set({ activeVersion: version, updatedAt: new Date() })
        .where(eq(workflows.id, workflowId))
        .returning();

      return updated;
    });
  }
}

import { eq, desc, and, count, sql } from "drizzle-orm";
import { runs } from "../schema/index.js";
import type { Database } from "../client.js";

/**
 * Provides CRUD and query operations for workflow runs.
 */
export class RunRepository {
  constructor(private readonly db: Database) {}

  /** Insert a new run row. */
  async create(data: typeof runs.$inferInsert) {
    const [row] = await this.db.insert(runs).values(data).returning();
    return row;
  }

  /** Retrieve a single run by ID. */
  async findById(id: string) {
    return this.db.query.runs.findFirst({
      where: eq(runs.id, id),
    });
  }

  /** List all runs for a workflow, newest first. */
  async findByWorkflow(workflowId: string) {
    return this.db.query.runs.findMany({
      where: eq(runs.workflowId, workflowId),
      orderBy: desc(runs.createdAt),
    });
  }

  /** Transition a run's status and optionally set timing fields. */
  async updateStatus(
    id: string,
    status: string,
    extra?: Partial<typeof runs.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(runs)
      .set({ status, ...extra })
      .where(eq(runs.id, id))
      .returning();
    return row;
  }

  /** Get the N most recent runs across all workflows in an org. */
  async getRecent(orgId: string, limit = 20) {
    return this.db.query.runs.findMany({
      where: eq(runs.orgId, orgId),
      orderBy: desc(runs.createdAt),
      limit,
    });
  }

  /** Count runs per org — used for tier-limit enforcement. */
  async countByOrg(orgId: string) {
    const [result] = await this.db
      .select({ value: count() })
      .from(runs)
      .where(eq(runs.orgId, orgId));
    return result?.value ?? 0;
  }
}

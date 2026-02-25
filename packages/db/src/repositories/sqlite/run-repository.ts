import { eq, desc, count } from "drizzle-orm";
import { sqliteRuns } from "../../schema/sqlite.js";
import type { SqliteDatabase } from "../../sqlite-client.js";

/**
 * SQLite-backed run repository — same API surface as the PG version.
 */
export class SqliteRunRepository {
  constructor(private readonly db: SqliteDatabase) {}

  /** Insert a new run row. */
  async create(data: typeof sqliteRuns.$inferInsert) {
    const [row] = await this.db.insert(sqliteRuns).values(data).returning();
    return row;
  }

  /** Retrieve a single run by ID. */
  async findById(id: string) {
    return this.db.query.sqliteRuns.findFirst({
      where: eq(sqliteRuns.id, id),
    });
  }

  /** List all runs for a workflow, newest first. */
  async findByWorkflow(workflowId: string) {
    return this.db.query.sqliteRuns.findMany({
      where: eq(sqliteRuns.workflowId, workflowId),
      orderBy: desc(sqliteRuns.createdAt),
    });
  }

  /** Transition a run's status and optionally set timing fields. */
  async updateStatus(
    id: string,
    status: string,
    extra?: Partial<typeof sqliteRuns.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(sqliteRuns)
      .set({ status, ...extra })
      .where(eq(sqliteRuns.id, id))
      .returning();
    return row;
  }

  /** Get the N most recent runs across all workflows in an org. */
  async getRecent(orgId: string, limit = 20) {
    return this.db.query.sqliteRuns.findMany({
      where: eq(sqliteRuns.orgId, orgId),
      orderBy: desc(sqliteRuns.createdAt),
      limit,
    });
  }

  /** Count runs per org — used for tier-limit enforcement. */
  async countByOrg(orgId: string) {
    const [result] = await this.db
      .select({ value: count() })
      .from(sqliteRuns)
      .where(eq(sqliteRuns.orgId, orgId));
    return result?.value ?? 0;
  }
}

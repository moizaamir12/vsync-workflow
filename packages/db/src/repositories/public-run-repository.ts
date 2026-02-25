import { eq, desc, and, count, sql, gte } from "drizzle-orm";
import { publicRuns } from "../schema/index.js";
import type { Database } from "../client.js";

/**
 * Provides CRUD and query operations for public (anonymous) workflow runs.
 * Mirrors RunRepository but targets the public_runs table and includes
 * IP-based rate-limit queries.
 */
export class PublicRunRepository {
  constructor(private readonly db: Database) {}

  /** Insert a new public run row. */
  async create(data: typeof publicRuns.$inferInsert) {
    const [row] = await this.db.insert(publicRuns).values(data).returning();
    return row;
  }

  /** Retrieve a single public run by ID. */
  async findById(id: string) {
    return this.db.query.publicRuns.findFirst({
      where: eq(publicRuns.id, id),
    });
  }

  /** List public runs for a workflow slug, newest first. */
  async findBySlug(slug: string, limit = 50) {
    return this.db.query.publicRuns.findMany({
      where: eq(publicRuns.publicSlug, slug),
      orderBy: desc(publicRuns.createdAt),
      limit,
    });
  }

  /** Transition a public run's status and optionally set timing fields. */
  async updateStatus(
    id: string,
    status: string,
    extra?: Partial<typeof publicRuns.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(publicRuns)
      .set({ status, ...extra })
      .where(eq(publicRuns.id, id))
      .returning();
    return row;
  }

  /**
   * Count runs from a specific IP hash within a time window.
   * Used by rate-limit middleware to enforce per-slug limits.
   */
  async countByIpInWindow(
    slug: string,
    ipHash: string,
    windowStart: Date,
  ): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(publicRuns)
      .where(
        and(
          eq(publicRuns.publicSlug, slug),
          eq(publicRuns.ipHash, ipHash),
          gte(publicRuns.createdAt, windowStart),
        ),
      );
    return result?.value ?? 0;
  }

  /** Count total public runs for a workflow (analytics). */
  async countBySlug(slug: string): Promise<number> {
    const [result] = await this.db
      .select({ value: count() })
      .from(publicRuns)
      .where(eq(publicRuns.publicSlug, slug));
    return result?.value ?? 0;
  }
}

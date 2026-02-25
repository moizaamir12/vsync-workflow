import { eq, inArray } from "drizzle-orm";
import { artifacts } from "../schema/index.js";
import type { Database } from "../client.js";

/**
 * Provides CRUD operations for binary artifacts (images, docs, etc.).
 */
export class ArtifactRepository {
  constructor(private readonly db: Database) {}

  /** Insert a new artifact row. */
  async create(data: typeof artifacts.$inferInsert) {
    const [row] = await this.db.insert(artifacts).values(data).returning();
    return row;
  }

  /** List all artifacts produced by a run. */
  async findByRun(runId: string) {
    return this.db.query.artifacts.findMany({
      where: eq(artifacts.runId, runId),
    });
  }

  /** Hard-delete a single artifact by ID. */
  async delete(id: string) {
    await this.db.delete(artifacts).where(eq(artifacts.id, id));
  }

  /** Hard-delete multiple artifacts in one statement. */
  async bulkDelete(ids: string[]) {
    if (ids.length === 0) return;
    await this.db.delete(artifacts).where(inArray(artifacts.id, ids));
  }
}

import { eq, inArray } from "drizzle-orm";
import { sqliteArtifacts } from "../../schema/sqlite.js";
import type { SqliteDatabase } from "../../sqlite-client.js";

/**
 * SQLite-backed artifact repository — same API surface as the PG version.
 */
export class SqliteArtifactRepository {
  constructor(private readonly db: SqliteDatabase) {}

  /** Insert a new artifact row. */
  async create(data: typeof sqliteArtifacts.$inferInsert) {
    const [row] = await this.db.insert(sqliteArtifacts).values(data).returning();
    return row;
  }

  /** List all artifacts produced by a run. */
  async findByRun(runId: string) {
    return this.db.query.sqliteArtifacts.findMany({
      where: eq(sqliteArtifacts.runId, runId),
    });
  }

  /** Hard-delete a single artifact by ID. */
  async delete(id: string) {
    await this.db.delete(sqliteArtifacts).where(eq(sqliteArtifacts.id, id));
  }

  /** Hard-delete multiple artifacts in one statement. */
  async bulkDelete(ids: string[]) {
    if (ids.length === 0) return;
    await this.db.delete(sqliteArtifacts).where(inArray(sqliteArtifacts.id, ids));
  }
}

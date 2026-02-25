import { eq } from "drizzle-orm";
import { sqliteUsers } from "../../schema/sqlite.js";
import type { SqliteDatabase } from "../../sqlite-client.js";

/**
 * SQLite-backed user repository — same API surface as the PG version.
 */
export class SqliteUserRepository {
  constructor(private readonly db: SqliteDatabase) {}

  /** Retrieve a user by primary key. */
  async findById(id: string) {
    return this.db.query.sqliteUsers.findFirst({
      where: eq(sqliteUsers.id, id),
    });
  }

  /** Look up a user by email — used during authentication. */
  async findByEmail(email: string) {
    return this.db.query.sqliteUsers.findFirst({
      where: eq(sqliteUsers.email, email),
    });
  }

  /** Insert a new user row. */
  async create(data: typeof sqliteUsers.$inferInsert) {
    const [row] = await this.db.insert(sqliteUsers).values(data).returning();
    return row;
  }

  /** Partial update of a user's mutable fields. */
  async update(id: string, data: Partial<typeof sqliteUsers.$inferInsert>) {
    const [row] = await this.db
      .update(sqliteUsers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sqliteUsers.id, id))
      .returning();
    return row;
  }
}

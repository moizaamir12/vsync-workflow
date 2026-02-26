import { eq } from "drizzle-orm";
import { users } from "../schema/index.js";
import type { Database } from "../client.js";

/**
 * Provides CRUD operations for user accounts.
 */
export class UserRepository {
  constructor(private readonly db: Database) {}

  /** Retrieve a user by primary key. */
  async findById(id: string) {
    return this.db.query.users.findFirst({
      where: eq(users.id, id),
    });
  }

  /** Look up a user by email — used during authentication. */
  async findByEmail(email: string) {
    return this.db.query.users.findFirst({
      where: eq(users.email, email),
    });
  }

  /** Insert a new user row. */
  async create(data: typeof users.$inferInsert) {
    const [row] = await this.db.insert(users).values(data).returning();
    return row;
  }

  /** Partial update of a user's mutable fields. */
  async update(id: string, data: Partial<typeof users.$inferInsert>) {
    // TODO: Handle case where update returns empty array (no matching row) — currently returns undefined silently.
    const [row] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return row;
  }
}

import { eq, and } from "drizzle-orm";
import { sqliteOrganizations, sqliteOrgMembers } from "../../schema/sqlite.js";
import type { SqliteDatabase } from "../../sqlite-client.js";

/**
 * SQLite-backed organization repository — same API surface as the PG version.
 */
export class SqliteOrgRepository {
  constructor(private readonly db: SqliteDatabase) {}

  /** Retrieve an organization by primary key. */
  async findById(id: string) {
    return this.db.query.sqliteOrganizations.findFirst({
      where: eq(sqliteOrganizations.id, id),
    });
  }

  /** Look up an organization by its URL slug. */
  async findBySlug(slug: string) {
    return this.db.query.sqliteOrganizations.findFirst({
      where: eq(sqliteOrganizations.slug, slug),
    });
  }

  /** Insert a new organization. */
  async create(data: typeof sqliteOrganizations.$inferInsert) {
    const [row] = await this.db
      .insert(sqliteOrganizations)
      .values(data)
      .returning();
    return row;
  }

  /** Add a user to an organization with a specific role. */
  async addMember(orgId: string, userId: string, role = "member") {
    const [row] = await this.db
      .insert(sqliteOrgMembers)
      .values({ orgId, userId, role })
      .returning();
    return row;
  }

  /** List all members of an organization. */
  async getMembers(orgId: string) {
    return this.db.query.sqliteOrgMembers.findMany({
      where: eq(sqliteOrgMembers.orgId, orgId),
    });
  }

  /** Retrieve a specific member's role in an organization. */
  async getMemberRole(orgId: string, userId: string) {
    const member = await this.db.query.sqliteOrgMembers.findFirst({
      where: and(
        eq(sqliteOrgMembers.orgId, orgId),
        eq(sqliteOrgMembers.userId, userId),
      ),
    });
    return member?.role ?? null;
  }
}

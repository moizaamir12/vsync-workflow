import { eq, and } from "drizzle-orm";
import { organizations, orgMembers } from "../schema/index.js";
import type { Database } from "../client.js";

/**
 * Provides CRUD and membership operations for organizations.
 */
export class OrgRepository {
  constructor(private readonly db: Database) {}

  /** Retrieve an organization by primary key. */
  async findById(id: string) {
    return this.db.query.organizations.findFirst({
      where: eq(organizations.id, id),
    });
  }

  /** Look up an organization by its URL slug. */
  async findBySlug(slug: string) {
    return this.db.query.organizations.findFirst({
      where: eq(organizations.slug, slug),
    });
  }

  /** Insert a new organization. */
  async create(data: typeof organizations.$inferInsert) {
    const [row] = await this.db
      .insert(organizations)
      .values(data)
      .returning();
    return row;
  }

  /** Add a user to an organization with a specific role. */
  async addMember(orgId: string, userId: string, role = "member") {
    const [row] = await this.db
      .insert(orgMembers)
      .values({ orgId, userId, role })
      .returning();
    return row;
  }

  /** List all members of an organization. */
  async getMembers(orgId: string) {
    return this.db.query.orgMembers.findMany({
      where: eq(orgMembers.orgId, orgId),
    });
  }

  /** Retrieve a specific member's role in an organization. */
  async getMemberRole(orgId: string, userId: string) {
    const member = await this.db.query.orgMembers.findFirst({
      where: and(
        eq(orgMembers.orgId, orgId),
        eq(orgMembers.userId, userId),
      ),
    });
    return member?.role ?? null;
  }
}

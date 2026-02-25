import { eq, and, sql } from "drizzle-orm";
import { cache } from "../schema/index.js";
import type { Database } from "../client.js";

/**
 * Provides get/set/delete operations for the ephemeral org-scoped cache.
 */
export class CacheRepository {
  constructor(private readonly db: Database) {}

  /** Retrieve a cached value and bump access counters. */
  async get(key: string, orgId: string) {
    const row = await this.db.query.cache.findFirst({
      where: and(eq(cache.key, key), eq(cache.orgId, orgId)),
    });

    if (row) {
      /* Fire-and-forget access tracking */
      await this.db
        .update(cache)
        .set({
          accessedAt: new Date(),
          accessCount: sql`${cache.accessCount} + 1`,
        })
        .where(and(eq(cache.key, key), eq(cache.orgId, orgId)));
    }

    return row?.value ?? null;
  }

  /** Upsert a cache entry. */
  async set(key: string, orgId: string, value: unknown) {
    await this.db
      .insert(cache)
      .values({ key, orgId, value })
      .onConflictDoUpdate({
        target: [cache.key, cache.orgId],
        set: { value, accessedAt: new Date() },
      });
  }

  /** Remove a single cache entry. */
  async delete(key: string, orgId: string) {
    await this.db
      .delete(cache)
      .where(and(eq(cache.key, key), eq(cache.orgId, orgId)));
  }

  /** Wipe all cache entries for an organization. */
  async clearOrg(orgId: string) {
    await this.db.delete(cache).where(eq(cache.orgId, orgId));
  }
}

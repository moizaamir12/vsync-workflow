import { eq, and, sql, lte } from "drizzle-orm";
import { cache } from "../schema/index.js";
import type { Database } from "../client.js";

/**
 * Provides get/set/delete operations for the ephemeral org-scoped cache.
 */
export class CacheRepository {
  constructor(private readonly db: Database) {}

  /** Retrieve a cached value and bump access counters. Returns null for expired entries. */
  async get(key: string, orgId: string) {
    const row = await this.db.query.cache.findFirst({
      where: and(eq(cache.key, key), eq(cache.orgId, orgId)),
    });

    if (!row) return null;

    // Treat expired entries as cache misses
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      // Clean up the expired entry in the background
      await this.db
        .delete(cache)
        .where(and(eq(cache.key, key), eq(cache.orgId, orgId)));
      return null;
    }

    /* Fire-and-forget access tracking */
    await this.db
      .update(cache)
      .set({
        accessedAt: new Date(),
        accessCount: sql`${cache.accessCount} + 1`,
      })
      .where(and(eq(cache.key, key), eq(cache.orgId, orgId)));

    return row?.value ?? null;
  }

  /** Upsert a cache entry with an optional TTL in seconds. */
  async set(key: string, orgId: string, value: unknown, ttlSeconds?: number) {
    const expiresAt = ttlSeconds
      ? new Date(Date.now() + ttlSeconds * 1000)
      : null;

    await this.db
      .insert(cache)
      .values({ key, orgId, value, expiresAt })
      .onConflictDoUpdate({
        target: [cache.key, cache.orgId],
        set: { value, expiresAt, accessedAt: new Date() },
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

  /** Purge all expired cache entries across all organizations. */
  async deleteExpired() {
    await this.db
      .delete(cache)
      .where(lte(cache.expiresAt, new Date()));
  }
}

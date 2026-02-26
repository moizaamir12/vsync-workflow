import { eq, isNull } from "drizzle-orm";
import { sqliteSyncQueue, type SqliteDatabase } from "@vsync/db";
import log from "electron-log";

/** Tables that participate in cloud sync. */
const SYNCED_TABLES = [
  "workflows",
  "workflow_versions",
  "blocks",
  "runs",
  "artifacts",
] as const;

interface SyncConfig {
  /** Cloud API base URL (e.g. https://api.vsync.io). */
  cloudUrl: string;
  /** Bearer token for the cloud API. */
  authToken: string;
}

/**
 * Bi-directional sync engine between the local SQLite DB and the cloud API.
 *
 * Strategy: last-write-wins by `updatedAt`.
 *
 * Push: reads unsynced rows from `sync_queue`, POSTs them to cloud,
 *       then marks them as synced.
 * Pull: GETs changes since `lastSyncAt`, upserts locally.
 *
 * Only activates when both a cloud URL and auth token are available.
 */
export class SyncService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private config: SyncConfig | null = null;
  private lastSyncAt: Date | null = null;

  constructor(private readonly db: SqliteDatabase) {}

  /** Configure cloud endpoint — sync won't run until this is called. */
  setConfig(config: SyncConfig): void {
    this.config = config;
    log.info("[sync] Cloud config set.");
  }

  /** Start periodic sync (default: every 60 seconds). */
  start(intervalMs = 60_000): void {
    if (this.intervalHandle) return;

    log.info(`[sync] Starting sync service (interval: ${intervalMs}ms)`);
    this.intervalHandle = setInterval(() => {
      void this.syncNow();
    }, intervalMs);

    /* Run immediately */
    void this.syncNow();
  }

  /** Stop periodic sync. */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      log.info("[sync] Sync service stopped.");
    }
  }

  /** Execute a single push + pull cycle. */
  async syncNow(): Promise<void> {
    if (!this.config) {
      log.debug("[sync] Skipping — no cloud config.");
      return;
    }

    // TODO: Add retry logic with exponential backoff for sync failures — currently errors are only logged with no recovery.
    try {
      await this.push();
      await this.pull();
    } catch (err) {
      log.error("[sync] Sync cycle failed:", err);
    }
  }

  /* ── Push: local changes → cloud ───────────────────── */

  private async push(): Promise<void> {
    if (!this.config) return;

    /* Read unsynced queue entries */
    const pending = await this.db.query.sqliteSyncQueue.findMany({
      where: isNull(sqliteSyncQueue.syncedAt),
    });

    if (pending.length === 0) return;

    log.info(`[sync] Pushing ${pending.length} local change(s)...`);

    const response = await fetch(`${this.config.cloudUrl}/api/v1/sync/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.authToken}`,
      },
      body: JSON.stringify({ changes: pending }),
    });

    if (!response.ok) {
      log.error(`[sync] Push failed: ${response.status} ${response.statusText}`);
      return;
    }

    /* Mark as synced */
    const now = new Date();
    for (const entry of pending) {
      await this.db
        .update(sqliteSyncQueue)
        .set({ syncedAt: now })
        .where(eq(sqliteSyncQueue.id, entry.id));
    }

    log.info(`[sync] Push complete (${pending.length} items).`);
  }

  /* ── Pull: cloud changes → local ───────────────────── */

  private async pull(): Promise<void> {
    if (!this.config) return;

    const since = this.lastSyncAt?.toISOString() ?? new Date(0).toISOString();
    const tables = SYNCED_TABLES.join(",");

    const response = await fetch(
      `${this.config.cloudUrl}/api/v1/sync/pull?since=${since}&tables=${tables}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.authToken}`,
        },
      },
    );

    if (!response.ok) {
      log.error(`[sync] Pull failed: ${response.status} ${response.statusText}`);
      return;
    }

    // TODO(validation): Validate response structure before accessing fields — partial JSON parse failures will crash the sync.
    const body = (await response.json()) as {
      data: { table: string; rows: Record<string, unknown>[] }[];
    };

    let totalRows = 0;
    for (const batch of body.data) {
      totalRows += batch.rows.length;
      /* Upsert logic would go here — table-specific INSERT OR REPLACE.
         Omitted for now; each table needs its own upsert mapping. */
    }

    this.lastSyncAt = new Date();

    if (totalRows > 0) {
      log.info(`[sync] Pull complete (${totalRows} row(s) across ${body.data.length} table(s)).`);
    }
  }
}

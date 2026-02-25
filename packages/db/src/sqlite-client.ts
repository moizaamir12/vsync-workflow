import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema/sqlite.js";

/**
 * Drizzle instance backed by better-sqlite3.
 * Used by the desktop Electron app for offline-first local storage.
 */
export type SqliteDatabase = ReturnType<typeof createSQLiteClient>;

/**
 * Creates a Drizzle client backed by better-sqlite3.
 * Enables WAL mode for concurrent reads and foreign key enforcement.
 */
export function createSQLiteClient(filePath: string) {
  const sqlite = new Database(filePath);

  /* WAL mode allows concurrent reads while writing */
  sqlite.pragma("journal_mode = WAL");
  /* Enforce FK constraints at the engine level */
  sqlite.pragma("foreign_keys = ON");

  return drizzle(sqlite, { schema });
}

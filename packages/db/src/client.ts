import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import postgres from "postgres";
import type { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema/index.js";

/**
 * Drizzle instance backed by any Postgres-compatible driver.
 * All repositories accept this type — both postgres.js (production)
 * and PGlite (in-memory testing) satisfy it.
 */
export type Database = ReturnType<typeof createPostgresClient>;

/**
 * Creates a Drizzle client backed by PostgreSQL via postgres.js.
 * Use this in production and staging environments.
 */
export function createPostgresClient(connectionString: string) {
  const client = postgres(connectionString);
  return drizzlePg(client, { schema });
}

/**
 * Creates a Drizzle client backed by PGlite (in-memory Postgres).
 * Use this for tests and local development without an external DB.
 *
 * PGlite is a WASM-compiled PostgreSQL engine that runs entirely
 * in-process, so pgTable schemas work without modification.
 */
export function createPgliteClient(pglite: PGlite) {
  return drizzlePglite(pglite, { schema });
}

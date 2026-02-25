import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createPostgresClient } from "./client.js";

const MIGRATIONS_FOLDER = new URL("./migrations", import.meta.url).pathname;

/**
 * Runs pending Drizzle migrations against a PostgreSQL database.
 * Reads the connection string from the DATABASE_URL env var.
 */
async function main(): Promise<void> {
  const url = process.env["DATABASE_URL"];

  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const db = createPostgresClient(url);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("PostgreSQL migrations applied");
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

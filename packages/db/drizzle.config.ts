import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./src/schema/auth.ts",
    "./src/schema/organizations.ts",
    "./src/schema/workflows.ts",
    "./src/schema/runs.ts",
    "./src/schema/cache.ts",
    "./src/schema/devices.ts",
    "./src/schema/keys.ts",
    "./src/schema/chats.ts",
  ],
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://localhost:5432/vsync",
  },
});

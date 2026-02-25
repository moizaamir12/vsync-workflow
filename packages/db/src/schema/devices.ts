import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  real,
  jsonb,
} from "drizzle-orm/pg-core";

/** A registered execution agent (phone, desktop, kiosk, etc.). */
export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  orgId: uuid("org_id"),
  hardwareId: text("hardware_id").unique(),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  platform: text("platform"),
  arch: text("arch"),
  executionEnvironment: text("execution_environment").default("desktop"),
  tags: jsonb("tags"),
  cpuCores: integer("cpu_cores"),
  memoryGb: real("memory_gb"),
  diskGb: real("disk_gb"),
  lastSeenAt: timestamp("last_seen_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

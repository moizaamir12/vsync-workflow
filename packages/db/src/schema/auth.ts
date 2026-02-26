import { pgTable, text, uuid, timestamp, boolean } from "drizzle-orm/pg-core";

/** Core user identity — every person who can sign in. */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique().notNull(),
  name: text("name"),
  emailVerified: boolean("email_verified").default(false),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// TODO(perf): Add index on user_id for fast session lookups by user.
/** Active login sessions — one per device/browser. */
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  // TODO: Add onDelete: "cascade" so sessions are cleaned up when a user is deleted.
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  token: text("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// TODO(perf): Add index on user_id for fast account lookups by user.
/** Linked OAuth / SSO provider accounts. */
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  // TODO: Add onDelete: "cascade" so accounts are cleaned up when a user is deleted.
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// TODO(perf): Add composite index on (identifier, expires_at) for efficient token lookups.
/** Email / phone verification tokens. */
export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

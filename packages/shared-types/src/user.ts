/**
 * Role-based access levels within an organization.
 * Ordered from most to least privileged.
 */
export type UserRole = "owner" | "admin" | "member" | "viewer";

/**
 * Billing plan tiers.
 * Determines feature gates, rate limits, and storage quotas.
 */
export type PlanTier = "free" | "pro" | "enterprise";

/**
 * A person who can sign in and interact with the system.
 * Users always belong to exactly one organization.
 */
export interface User {
  /** Unique identifier */
  id: string;

  /** Primary email address — also used for login */
  email: string;

  /** Display name shown in the UI */
  name: string;

  /** URL to the user's profile picture */
  avatarUrl?: string;

  /** Access level within the organization */
  role: UserRole;

  /** Organization the user belongs to */
  orgId: string;

  /** ISO-8601 timestamp of account creation */
  createdAt: string;

  /** ISO-8601 timestamp of last profile update */
  updatedAt: string;
}

/**
 * A tenant that owns workflows, users, and billing.
 * All data is scoped to an organization for multi-tenant isolation.
 */
export interface Organization {
  /** Unique identifier */
  id: string;

  /** Display name of the organization */
  name: string;

  /** URL-safe unique slug (e.g. "acme-corp") */
  slug: string;

  /** Current billing plan — controls feature availability */
  plan: PlanTier;

  /** ISO-8601 timestamp of creation */
  createdAt: string;
}

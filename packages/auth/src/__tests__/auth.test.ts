import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
/**
 * Import the full @vsync/db namespace so Drizzle's relational
 * query builder can discover table relations. The `Database`
 * type is pulled separately for the cast.
 */
import * as dbExports from "@vsync/db";
import type { Database } from "@vsync/db";

import {
  ROLE_HIERARCHY,
  checkPermission,
  canEditWorkflow,
  canDeleteWorkflow,
  canViewWorkflow,
  canManageOrg,
  canInviteMembers,
} from "../permissions.js";
import type { RoleName } from "../permissions.js";
import { configureSAML, configureOIDC, getSSOConfig } from "../sso.js";

/**
 * Auth package tests using PGlite (in-memory Postgres).
 * Tests cover the permissions system and SSO configuration —
 * the two pieces that are fully testable without spinning up
 * a real Better Auth server + HTTP layer.
 */

let pglite: PGlite;
let db: Database;

beforeAll(async () => {
  pglite = new PGlite();
  db = drizzle(pglite, { schema: dbExports }) as unknown as Database;

  /* Minimal DDL for the tables used by SSO and permission tests */

  await db.execute(sql`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      email_verified BOOLEAN DEFAULT false,
      avatar_url TEXT,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      plan TEXT DEFAULT 'free',
      sso_config JSONB,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE org_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id),
      user_id UUID NOT NULL REFERENCES users(id),
      role TEXT DEFAULT 'member',
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE(org_id, user_id)
    )
  `);
});

afterAll(async () => {
  await pglite.close();
});

/* ── Helpers ─────────────────────────────────────────────────────── */

async function createOrg(plan: string = "free"): Promise<string> {
  const slug = `org-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const result = await db.execute(sql`
    INSERT INTO organizations (name, slug, plan)
    VALUES (${`Test Org ${slug}`}, ${slug}, ${plan})
    RETURNING id
  `);
  return String((result.rows[0] as Record<string, unknown>)["id"]);
}

/* ── checkPermission ─────────────────────────────────────────────── */

describe("checkPermission", () => {
  it("returns true when user role meets the required level", () => {
    expect(checkPermission("owner", "owner")).toBe(true);
    expect(checkPermission("owner", "admin")).toBe(true);
    expect(checkPermission("admin", "member")).toBe(true);
    expect(checkPermission("member", "viewer")).toBe(true);
  });

  it("returns false when user role is below the required level", () => {
    expect(checkPermission("viewer", "member")).toBe(false);
    expect(checkPermission("member", "admin")).toBe(false);
    expect(checkPermission("admin", "owner")).toBe(false);
  });

  it("validates all roles against themselves", () => {
    const roles: RoleName[] = ["owner", "admin", "member", "viewer"];
    for (const role of roles) {
      expect(checkPermission(role, role)).toBe(true);
    }
  });
});

/* ── ROLE_HIERARCHY ──────────────────────────────────────────────── */

describe("ROLE_HIERARCHY", () => {
  it("assigns strictly decreasing values: owner > admin > member > viewer", () => {
    expect(ROLE_HIERARCHY.owner).toBeGreaterThan(ROLE_HIERARCHY.admin);
    expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.member);
    expect(ROLE_HIERARCHY.member).toBeGreaterThan(ROLE_HIERARCHY.viewer);
  });

  it("has exactly four roles defined", () => {
    expect(Object.keys(ROLE_HIERARCHY)).toHaveLength(4);
  });
});

/* ── Workflow permissions ────────────────────────────────────────── */

describe("canEditWorkflow", () => {
  const workflow = { orgId: "org-1" };

  it("allows owner, admin, and member to edit", () => {
    expect(canEditWorkflow({ role: "owner", orgId: "org-1" }, workflow)).toBe(true);
    expect(canEditWorkflow({ role: "admin", orgId: "org-1" }, workflow)).toBe(true);
    expect(canEditWorkflow({ role: "member", orgId: "org-1" }, workflow)).toBe(true);
  });

  it("denies viewer from editing", () => {
    expect(canEditWorkflow({ role: "viewer", orgId: "org-1" }, workflow)).toBe(false);
  });

  it("denies users from a different org", () => {
    expect(canEditWorkflow({ role: "owner", orgId: "org-2" }, workflow)).toBe(false);
  });
});

describe("canDeleteWorkflow", () => {
  const workflow = { orgId: "org-1" };

  it("allows owner and admin to delete", () => {
    expect(canDeleteWorkflow({ role: "owner", orgId: "org-1" }, workflow)).toBe(true);
    expect(canDeleteWorkflow({ role: "admin", orgId: "org-1" }, workflow)).toBe(true);
  });

  it("denies member and viewer from deleting", () => {
    expect(canDeleteWorkflow({ role: "member", orgId: "org-1" }, workflow)).toBe(false);
    expect(canDeleteWorkflow({ role: "viewer", orgId: "org-1" }, workflow)).toBe(false);
  });

  it("denies users from a different org", () => {
    expect(canDeleteWorkflow({ role: "owner", orgId: "org-2" }, workflow)).toBe(false);
  });
});

describe("canViewWorkflow", () => {
  it("allows any org member to view a private workflow", () => {
    const workflow = { orgId: "org-1", isPublic: false };
    expect(canViewWorkflow({ role: "viewer", orgId: "org-1" }, workflow)).toBe(true);
    expect(canViewWorkflow({ role: "member", orgId: "org-1" }, workflow)).toBe(true);
  });

  it("allows anyone to view a public workflow", () => {
    const workflow = { orgId: "org-1", isPublic: true };
    /* Even a user from a different org can see public workflows */
    expect(canViewWorkflow({ role: "viewer", orgId: "org-2" }, workflow)).toBe(true);
  });

  it("denies cross-org access to private workflows", () => {
    const workflow = { orgId: "org-1", isPublic: false };
    expect(canViewWorkflow({ role: "owner", orgId: "org-2" }, workflow)).toBe(false);
  });
});

/* ── Organization permissions ────────────────────────────────────── */

describe("canManageOrg", () => {
  const org = { id: "org-1" };

  it("allows only owner to manage org", () => {
    expect(canManageOrg({ role: "owner", orgId: "org-1" }, org)).toBe(true);
  });

  it("denies admin, member, and viewer from managing org", () => {
    expect(canManageOrg({ role: "admin", orgId: "org-1" }, org)).toBe(false);
    expect(canManageOrg({ role: "member", orgId: "org-1" }, org)).toBe(false);
    expect(canManageOrg({ role: "viewer", orgId: "org-1" }, org)).toBe(false);
  });

  it("denies users from a different org", () => {
    expect(canManageOrg({ role: "owner", orgId: "org-2" }, org)).toBe(false);
  });
});

describe("canInviteMembers", () => {
  const org = { id: "org-1" };

  it("allows owner and admin to invite", () => {
    expect(canInviteMembers({ role: "owner", orgId: "org-1" }, org)).toBe(true);
    expect(canInviteMembers({ role: "admin", orgId: "org-1" }, org)).toBe(true);
  });

  it("denies member and viewer from inviting", () => {
    expect(canInviteMembers({ role: "member", orgId: "org-1" }, org)).toBe(false);
    expect(canInviteMembers({ role: "viewer", orgId: "org-1" }, org)).toBe(false);
  });
});

/* ── SSO configuration ───────────────────────────────────────────── */

describe("configureSAML", () => {
  it("stores SAML config for enterprise orgs", async () => {
    const orgId = await createOrg("enterprise");

    await configureSAML(db, orgId, {
      entityId: "https://idp.example.com/entity",
      ssoUrl: "https://idp.example.com/sso",
      certificate: "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----",
    });

    const config = await getSSOConfig(db, orgId);
    expect(config).not.toBeNull();
    expect(config?.provider).toBe("saml");
    expect(config?.entityId).toBe("https://idp.example.com/entity");
    expect(config?.ssoUrl).toBe("https://idp.example.com/sso");
    expect(config?.certificate).toContain("BEGIN CERTIFICATE");
  });

  it("rejects SAML config for non-enterprise orgs", async () => {
    const orgId = await createOrg("free");

    await expect(
      configureSAML(db, orgId, {
        entityId: "https://idp.example.com/entity",
        ssoUrl: "https://idp.example.com/sso",
        certificate: "cert",
      }),
    ).rejects.toThrow("SSO is only available on the Enterprise plan");
  });
});

describe("configureOIDC", () => {
  it("stores OIDC config for enterprise orgs", async () => {
    const orgId = await createOrg("enterprise");

    await configureOIDC(db, orgId, {
      clientId: "my-client-id",
      issuer: "https://login.example.com",
      redirectUri: "https://app.vsync.io/auth/callback",
    });

    const config = await getSSOConfig(db, orgId);
    expect(config).not.toBeNull();
    expect(config?.provider).toBe("oidc");
    expect(config?.clientId).toBe("my-client-id");
    expect(config?.issuer).toBe("https://login.example.com");
    expect(config?.redirectUri).toBe("https://app.vsync.io/auth/callback");
  });

  it("rejects OIDC config for pro-plan orgs", async () => {
    const orgId = await createOrg("pro");

    await expect(
      configureOIDC(db, orgId, {
        clientId: "my-client",
        issuer: "https://login.example.com",
        redirectUri: "https://app.vsync.io/auth/callback",
      }),
    ).rejects.toThrow("SSO is only available on the Enterprise plan");
  });
});

describe("getSSOConfig", () => {
  it("returns null when no SSO is configured", async () => {
    const orgId = await createOrg("enterprise");
    const config = await getSSOConfig(db, orgId);
    expect(config).toBeNull();
  });

  it("overwrites previous config when reconfigured", async () => {
    const orgId = await createOrg("enterprise");

    /* First configure SAML */
    await configureSAML(db, orgId, {
      entityId: "https://first-idp.example.com",
      ssoUrl: "https://first-idp.example.com/sso",
      certificate: "first-cert",
    });

    /* Then switch to OIDC */
    await configureOIDC(db, orgId, {
      clientId: "new-client",
      issuer: "https://oidc.example.com",
      redirectUri: "https://app.vsync.io/callback",
    });

    const config = await getSSOConfig(db, orgId);
    expect(config?.provider).toBe("oidc");
    expect(config?.clientId).toBe("new-client");
    /* SAML fields should not persist after OIDC overwrite */
    expect(config?.entityId).toBeUndefined();
  });
});

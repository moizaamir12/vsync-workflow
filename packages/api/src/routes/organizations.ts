import { Hono } from "hono";
import { z } from "zod";
import type { AuthInstance } from "@vsync/auth";
import { requireAuth, requireOrg, canManageOrg, canInviteMembers, configureSAML, configureOIDC } from "@vsync/auth";
import type { Database } from "@vsync/db";
import { OrgRepository, UserRepository } from "@vsync/db";
import { validateBody, validateParams } from "../middleware/validate.js";
import { orgContext } from "../middleware/org-context.js";
import { ok, err, notFound, forbidden } from "../lib/response.js";
import type { AppEnv } from "../lib/types.js";

const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
});

const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  plan: z.enum(["free", "pro", "enterprise"]).optional(),
});

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
});

const UpdateMemberSchema = z.object({
  role: z.enum(["owner", "admin", "member", "viewer"]),
});

const IdParam = z.object({ id: z.string().min(1) });
const MemberParam = z.object({ id: z.string().min(1), userId: z.string().min(1) });

const SSOConfigSchema = z.discriminatedUnion("provider", [
  z.object({
    provider: z.literal("saml"),
    entityId: z.string().url(),
    ssoUrl: z.string().url(),
    certificate: z.string().min(1),
  }),
  z.object({
    provider: z.literal("oidc"),
    clientId: z.string().min(1),
    issuer: z.string().url(),
    redirectUri: z.string().url(),
  }),
]);

export function organizationRoutes(auth: AuthInstance, db: Database) {
  const app = new Hono<AppEnv>();
  const orgRepo = new OrgRepository(db);
  const userRepo = new UserRepository(db);

  /* ── Create org ────────────────────────────────────────────── */

  app.post("/", requireAuth(auth), validateBody(CreateOrgSchema), async (c) => {
    const authCtx = c.get("auth");
    const { name } = c.req.valid("json");

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const existing = await orgRepo.findBySlug(slug);
    if (existing) {
      return err(c, "CONFLICT", "An organization with this name already exists", 409);
    }

    const org = await orgRepo.create({ name, slug });
    await orgRepo.addMember(org.id, authCtx.userId, "owner");
    return ok(c, org, undefined, 201);
  });

  /* ── List user's orgs ──────────────────────────────────────── */

  app.get("/", requireAuth(auth), async (c) => {
    const authCtx = c.get("auth");
    /**
     * A proper implementation would query org_members WHERE userId = authCtx.userId
     * and join orgs. For now, if user has an active org we return that one.
     */
    if (authCtx.orgId) {
      const org = await orgRepo.findById(authCtx.orgId);
      return ok(c, org ? [org] : []);
    }
    return ok(c, []);
  });

  /* ── Get org details ───────────────────────────────────────── */

  app.get("/:id", requireAuth(auth), validateParams(IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const org = await orgRepo.findById(id);
    if (!org) return notFound(c, "Organization");
    return ok(c, org);
  });

  /* ── Update org ────────────────────────────────────────────── */

  app.patch("/:id", requireAuth(auth), orgContext(), validateParams(IdParam), validateBody(UpdateOrgSchema), async (c) => {
    const authCtx = c.get("auth");
    const { id } = c.req.valid("param");

    if (!canManageOrg({ role: authCtx.role, orgId: authCtx.orgId }, { id })) {
      return forbidden(c, "Only the org owner can update settings");
    }

    const body = c.req.valid("json");
    const [updated] = await db
      .update((await import("@vsync/db")).organizations)
      .set({ ...body, updatedAt: new Date() })
      .where((await import("drizzle-orm")).eq((await import("@vsync/db")).organizations.id, id))
      .returning();

    if (!updated) return notFound(c, "Organization");
    return ok(c, updated);
  });

  /* ── Members ───────────────────────────────────────────────── */

  app.post("/:id/members", requireAuth(auth), orgContext(), validateParams(IdParam), validateBody(InviteMemberSchema), async (c) => {
    const authCtx = c.get("auth");
    const { id } = c.req.valid("param");

    if (!canInviteMembers({ role: authCtx.role, orgId: authCtx.orgId }, { id })) {
      return forbidden(c, "You need admin or owner role to invite members");
    }

    const { email, role } = c.req.valid("json");
    const user = await userRepo.findByEmail(email);
    if (!user) return notFound(c, "User");

    try {
      await orgRepo.addMember(id, user.id, role);
      return ok(c, { userId: user.id, role }, undefined, 201);
    } catch {
      return err(c, "CONFLICT", "User is already a member", 409);
    }
  });

  app.get("/:id/members", requireAuth(auth), validateParams(IdParam), async (c) => {
    const { id } = c.req.valid("param");
    const members = await orgRepo.getMembers(id);
    return ok(c, members);
  });

  app.patch("/:id/members/:userId", requireAuth(auth), orgContext(), validateParams(MemberParam), validateBody(UpdateMemberSchema), async (c) => {
    const authCtx = c.get("auth");
    const { id, userId } = c.req.valid("param");

    if (!canManageOrg({ role: authCtx.role, orgId: authCtx.orgId }, { id })) {
      return forbidden(c, "Only the org owner can change member roles");
    }

    const { role } = c.req.valid("json");
    /**
     * Updating a member role requires a direct DB update since
     * the OrgRepository only has addMember. A full implementation
     * would add an updateMemberRole method.
     */
    const { eq, and } = await import("drizzle-orm");
    const { orgMembers } = await import("@vsync/db");
    const [updated] = await db
      .update(orgMembers)
      .set({ role })
      .where(and(eq(orgMembers.orgId, id), eq(orgMembers.userId, userId)))
      .returning();

    if (!updated) return notFound(c, "Member");
    return ok(c, updated);
  });

  app.delete("/:id/members/:userId", requireAuth(auth), orgContext(), validateParams(MemberParam), async (c) => {
    const authCtx = c.get("auth");
    const { id, userId } = c.req.valid("param");

    if (!canManageOrg({ role: authCtx.role, orgId: authCtx.orgId }, { id })) {
      return forbidden(c, "Only the org owner can remove members");
    }

    const { eq, and } = await import("drizzle-orm");
    const { orgMembers } = await import("@vsync/db");
    await db
      .delete(orgMembers)
      .where(and(eq(orgMembers.orgId, id), eq(orgMembers.userId, userId)));

    return ok(c, { message: "Member removed" });
  });

  /* ── SSO (Enterprise) ──────────────────────────────────────── */

  app.post("/:id/sso", requireAuth(auth), orgContext(), validateParams(IdParam), validateBody(SSOConfigSchema), async (c) => {
    const authCtx = c.get("auth");
    const { id } = c.req.valid("param");

    if (!canManageOrg({ role: authCtx.role, orgId: authCtx.orgId }, { id })) {
      return forbidden(c, "Only the org owner can configure SSO");
    }

    const body = c.req.valid("json");
    try {
      if (body.provider === "saml") {
        await configureSAML(db, id, body);
      } else {
        await configureOIDC(db, id, body);
      }
      return ok(c, { message: "SSO configured" }, undefined, 201);
    } catch (e) {
      return err(c, "SSO_ERROR", (e as Error).message, 400);
    }
  });

  return app;
}

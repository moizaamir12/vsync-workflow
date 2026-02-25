/** The four role names used across the V Sync system. */
export type RoleName = "owner" | "admin" | "member" | "viewer";

/**
 * Numeric values for each role. Higher number = more privilege.
 * Comparisons use >= so an owner (100) satisfies a member (50) check.
 */
export const ROLE_HIERARCHY: Record<RoleName, number> = {
  owner: 100,
  admin: 75,
  member: 50,
  viewer: 25,
} as const;

/**
 * Returns true when the user's role is at or above the required level.
 * Used by middleware and permission checks throughout the codebase.
 */
export function checkPermission(
  userRole: RoleName,
  requiredRole: RoleName,
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/** Permission check input — keeps function signatures consistent. */
interface PermissionContext {
  role: RoleName;
  orgId: string;
}

/** Minimal workflow ownership info needed for permission checks. */
interface WorkflowContext {
  orgId: string;
  isPublic?: boolean;
}

/** Minimal org ownership info needed for permission checks. */
interface OrgContext {
  id: string;
}

// ── Workflow permissions ─────────────────────────────────────────

/**
 * Can the user edit this workflow?
 * Allowed: owner, admin, member (viewers cannot edit).
 */
export function canEditWorkflow(
  user: PermissionContext,
  workflow: WorkflowContext,
): boolean {
  if (user.orgId !== workflow.orgId) return false;
  return checkPermission(user.role, "member");
}

/**
 * Can the user delete this workflow?
 * Allowed: owner, admin only.
 */
export function canDeleteWorkflow(
  user: PermissionContext,
  workflow: WorkflowContext,
): boolean {
  if (user.orgId !== workflow.orgId) return false;
  return checkPermission(user.role, "admin");
}

/**
 * Can the user view this workflow?
 * Allowed: any org member, OR the workflow is public.
 */
export function canViewWorkflow(
  user: PermissionContext,
  workflow: WorkflowContext,
): boolean {
  if (workflow.isPublic) return true;
  if (user.orgId !== workflow.orgId) return false;
  return checkPermission(user.role, "viewer");
}

// ── Organization permissions ─────────────────────────────────────

/**
 * Can the user manage org settings (billing, SSO, danger zone)?
 * Allowed: owner only.
 */
export function canManageOrg(
  user: PermissionContext,
  org: OrgContext,
): boolean {
  if (user.orgId !== org.id) return false;
  return checkPermission(user.role, "owner");
}

/**
 * Can the user invite new members to the organization?
 * Allowed: owner, admin.
 */
export function canInviteMembers(
  user: PermissionContext,
  org: OrgContext,
): boolean {
  if (user.orgId !== org.id) return false;
  return checkPermission(user.role, "admin");
}

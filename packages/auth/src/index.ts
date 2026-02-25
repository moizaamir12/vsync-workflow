/* ── Server ────────────────────────────────────────────────────── */
export { createAuthServer } from "./server.js";
export type { AuthInstance } from "./server.js";

/* ── Client ────────────────────────────────────────────────────── */
export { createAuthClient } from "./client.js";
export type { AuthSession, VsyncAuthClient } from "./client.js";

/* ── Middleware ─────────────────────────────────────────────────── */
export {
  requireAuth,
  requireRole,
  requireOrg,
  optionalAuth,
  rateLimiter,
} from "./middleware.js";
export type { AuthContext } from "./middleware.js";

/* ── Permissions ───────────────────────────────────────────────── */
export {
  ROLE_HIERARCHY,
  checkPermission,
  canEditWorkflow,
  canDeleteWorkflow,
  canViewWorkflow,
  canManageOrg,
  canInviteMembers,
} from "./permissions.js";
export type { RoleName } from "./permissions.js";

/* ── SSO ───────────────────────────────────────────────────────── */
export {
  configureSAML,
  configureOIDC,
  getSSOConfig,
  handleSSOCallback,
} from "./sso.js";
export type {
  SAMLConfig,
  OIDCConfig,
  SSOConfigRecord,
} from "./sso.js";

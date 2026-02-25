import { eq } from "drizzle-orm";
import type { Database } from "@vsync/db";
import { organizations } from "@vsync/db";

/** SAML 2.0 configuration payload. */
export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  certificate: string;
}

/** OpenID Connect configuration payload. */
export interface OIDCConfig {
  clientId: string;
  issuer: string;
  redirectUri: string;
}

/**
 * Stored SSO configuration shape, persisted in the
 * organizations.ssoConfig jsonb column.
 */
export interface SSOConfigRecord {
  provider: "saml" | "oidc";
  entityId?: string;
  ssoUrl?: string;
  certificate?: string;
  clientId?: string;
  issuer?: string;
  redirectUri?: string;
}

/**
 * Validates that the organization is on the Enterprise plan
 * before allowing SSO configuration. SSO is a premium feature
 * to justify the enterprise pricing tier.
 */
async function requireEnterprisePlan(
  db: Database,
  orgId: string,
): Promise<void> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org) {
    throw new Error(`Organization ${orgId} not found`);
  }

  if (org.plan !== "enterprise") {
    throw new Error("SSO is only available on the Enterprise plan");
  }
}

/**
 * Configures SAML 2.0 SSO for an organization.
 * Stores the IdP metadata in the organizations.ssoConfig jsonb field.
 */
export async function configureSAML(
  db: Database,
  orgId: string,
  config: SAMLConfig,
): Promise<void> {
  await requireEnterprisePlan(db, orgId);

  const ssoConfig: SSOConfigRecord = {
    provider: "saml",
    entityId: config.entityId,
    ssoUrl: config.ssoUrl,
    certificate: config.certificate,
  };

  await db
    .update(organizations)
    .set({ ssoConfig, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
}

/**
 * Configures OpenID Connect SSO for an organization.
 * Stores the OIDC client metadata in the organizations.ssoConfig jsonb field.
 */
export async function configureOIDC(
  db: Database,
  orgId: string,
  config: OIDCConfig,
): Promise<void> {
  await requireEnterprisePlan(db, orgId);

  const ssoConfig: SSOConfigRecord = {
    provider: "oidc",
    clientId: config.clientId,
    issuer: config.issuer,
    redirectUri: config.redirectUri,
  };

  await db
    .update(organizations)
    .set({ ssoConfig, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
}

/**
 * Retrieves the SSO configuration for an organization.
 * Returns null if SSO is not configured.
 */
export async function getSSOConfig(
  db: Database,
  orgId: string,
): Promise<SSOConfigRecord | null> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  });

  if (!org?.ssoConfig) return null;
  return org.ssoConfig as SSOConfigRecord;
}

/**
 * Handles the SSO callback after the identity provider redirects back.
 * In a full implementation this would validate the SAML assertion or
 * exchange the OIDC authorization code for tokens. Currently delegates
 * to Better Auth's built-in OAuth handling for OIDC, and provides
 * the extension point for custom SAML processing.
 */
export async function handleSSOCallback(
  db: Database,
  orgId: string,
  _provider: "saml" | "oidc",
  _code: string,
  _state: string,
): Promise<{ email: string; name: string }> {
  const config = await getSSOConfig(db, orgId);
  if (!config) {
    throw new Error(`No SSO configuration found for org ${orgId}`);
  }

  /**
   * SAML assertion validation and OIDC token exchange
   * are handled by Better Auth's social provider pipeline.
   * This function is the extension point for custom logic
   * (e.g. attribute mapping, JIT provisioning).
   */
  throw new Error("Not implemented");
}

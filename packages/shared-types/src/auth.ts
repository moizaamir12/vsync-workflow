/**
 * Supported authentication providers.
 * Determines the login flow and token exchange mechanism.
 */
export type AuthProvider = "email" | "google" | "microsoft" | "saml" | "oidc";

/**
 * An active user session.
 * Sessions are short-lived and refreshed via token rotation.
 */
export interface Session {
  /** Unique session identifier */
  id: string;

  /** User this session belongs to */
  userId: string;

  /** Opaque bearer token sent in Authorization headers */
  token: string;

  /** ISO-8601 timestamp after which the session is invalid */
  expiresAt: string;

  /** Organization context for this session */
  orgId: string;
}

/**
 * Payload for email/password login attempts.
 * Password is optional to support passwordless (magic-link) flows.
 */
export interface LoginRequest {
  /** User's email address */
  email: string;

  /** Password — omitted for magic-link authentication */
  password?: string;
}

/**
 * Payload to initiate an OAuth or SSO login flow.
 * The server uses this to build the provider-specific authorize URL.
 */
export interface OAuthRequest {
  /** Which external identity provider to authenticate against */
  provider: AuthProvider;

  /** URL the provider should redirect back to after authentication */
  redirectUrl: string;
}

/**
 * Enterprise SSO configuration for an organization.
 * Supports both SAML 2.0 and OpenID Connect protocols.
 * Only the fields relevant to the chosen provider need to be set.
 */
export interface SSOConfig {
  /** SSO protocol in use */
  provider: "saml" | "oidc";

  /** SAML entity ID — identifies the service provider to the IdP */
  entityId?: string;

  /** SAML SSO endpoint URL where auth requests are sent */
  ssoUrl?: string;

  /** Base64-encoded X.509 certificate for SAML response verification */
  certificate?: string;

  /** OIDC client ID issued by the identity provider */
  clientId?: string;

  /** OIDC issuer URL for discovery (e.g. "https://accounts.google.com") */
  issuer?: string;
}

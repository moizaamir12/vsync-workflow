/**
 * Canonical type definitions for the key management system.
 *
 * These types are used by CloudKeyStore, LocalKeyStore, and
 * KeyResolver. They align with the `keys` / `keyAuditLog`
 * Drizzle schema in @vsync/db but are decoupled so the
 * key-manager package stays portable across platforms.
 */

/* ── Key classification ─────────────────────────────────────── */

export type KeyType =
  | "api_key"
  | "oauth_token"
  | "encryption_key"
  | "certificate"
  | "webhook_secret"
  | "custom";

export type Provider =
  | "custom"
  | "openai"
  | "anthropic"
  | "google"
  | "aws"
  | "azure"
  | "stripe"
  | "twilio"
  | (string & {});

export type StorageMode = "cloud" | "local" | "both";

/* ── Input / output shapes ──────────────────────────────────── */

/** Options for creating a new key in either store. */
export interface CreateKeyOpts {
  name: string;
  value: string;
  description?: string;
  keyType: KeyType;
  provider: Provider;
  storageMode: StorageMode;
  workflowId?: string;
  expiresAt?: Date;
  orgId: string;
}

/**
 * Metadata-only view of a key — never exposes the decrypted value.
 * Returned by list operations and cloud-to-local sync.
 */
export interface KeyMetadata {
  id: string;
  name: string;
  description: string | null;
  keyType: KeyType;
  provider: Provider;
  storageMode: StorageMode;
  workflowId: string | null;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  isRevoked: boolean;
  createdAt: Date | null;
}

/** Full key including decrypted plaintext value. */
export interface DecryptedKey extends KeyMetadata {
  value: string;
}

/* ── Audit log ──────────────────────────────────────────────── */

export type AuditAction = "created" | "accessed" | "rotated" | "revoked";

export interface AuditEntry {
  id: string;
  keyId: string;
  action: AuditAction;
  performedBy: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date | null;
}

/* ── Encryption primitives ──────────────────────────────────── */

/** Output of the `encrypt()` function. Both fields are hex-encoded. */
export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

/* ── Local storage adapter ──────────────────────────────────── */

/** Serialised form of the local encrypted key store. */
export interface EncryptedStore {
  version: number;
  keys: EncryptedStoreEntry[];
}

export interface EncryptedStoreEntry {
  id: string;
  name: string;
  description: string | null;
  keyType: KeyType;
  provider: Provider;
  storageMode: StorageMode;
  workflowId: string | null;
  orgId: string;
  /** Hex-encoded AES-256-GCM ciphertext */
  encryptedValue: string;
  /** Hex-encoded GCM IV */
  iv: string;
  expiresAt: string | null;
  isRevoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

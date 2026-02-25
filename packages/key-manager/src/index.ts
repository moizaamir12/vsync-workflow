/* ── Stores ─────────────────────────────────────────────────── */

export { CloudKeyStore } from "./cloud-store.js";
export { LocalKeyStore } from "./local-store.js";

/* ── Resolution ─────────────────────────────────────────────── */

export { KeyResolver } from "./key-resolver.js";
export type { ResolveContext } from "./key-resolver.js";

/* ── Encryption ─────────────────────────────────────────────── */

export {
  encrypt,
  decrypt,
  generateEncryptionKey,
  hashKeyName,
  resolveMasterKey,
} from "./crypto.js";

/* ── Adapters ───────────────────────────────────────────────── */

export type { LocalStorageAdapter } from "./adapters.js";
export { NodeAdapter, MobileAdapter, MemoryAdapter } from "./adapters.js";

/* ── Types ──────────────────────────────────────────────────── */

export type {
  CreateKeyOpts,
  KeyMetadata,
  DecryptedKey,
  KeyType,
  Provider,
  StorageMode,
  AuditAction,
  AuditEntry,
  EncryptedPayload,
  EncryptedStore,
  EncryptedStoreEntry,
} from "./types.js";

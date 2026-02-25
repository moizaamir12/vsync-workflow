import { nanoid } from "nanoid";
import { encrypt, decrypt, generateEncryptionKey } from "./crypto.js";
import type { LocalStorageAdapter } from "./adapters.js";
import type { CloudKeyStore } from "./cloud-store.js";
import type {
  CreateKeyOpts,
  DecryptedKey,
  KeyMetadata,
  EncryptedStoreEntry,
} from "./types.js";

/**
 * Local key storage for desktop and mobile platforms.
 *
 * Keys are encrypted with a platform-specific master key
 * (OS keychain on desktop, expo-secure-store on mobile)
 * and persisted in an encrypted JSON file or secure storage.
 *
 * Supports metadata-only sync from cloud (for offline access
 * awareness) and push-to-cloud for keys with storageMode='both'.
 */
export class LocalKeyStore {
  constructor(private readonly adapter: LocalStorageAdapter) {}

  /* ── Create ──────────────────────────────────────────────── */

  async createKey(opts: CreateKeyOpts): Promise<KeyMetadata> {
    const masterKey = await this.adapter.getMasterKey();
    const store = await this.adapter.readStore();

    /* Check for duplicate name */
    const exists = store.keys.some(
      (k) => k.name === opts.name && k.orgId === opts.orgId && !k.isRevoked,
    );
    if (exists) {
      throw new Error(`Key "${opts.name}" already exists locally`);
    }

    const { ciphertext, iv } = encrypt(opts.value, masterKey);
    const id = nanoid();
    const now = new Date();

    const entry: EncryptedStoreEntry = {
      id,
      name: opts.name,
      description: opts.description ?? null,
      keyType: opts.keyType,
      provider: opts.provider,
      storageMode: opts.storageMode,
      workflowId: opts.workflowId ?? null,
      orgId: opts.orgId,
      encryptedValue: ciphertext,
      iv,
      expiresAt: opts.expiresAt?.toISOString() ?? null,
      isRevoked: false,
      lastUsedAt: null,
      createdAt: now.toISOString(),
    };

    store.keys.push(entry);
    await this.adapter.writeStore(store);

    return this.toMetadata(entry);
  }

  /* ── Read ────────────────────────────────────────────────── */

  async getKey(name: string, orgId?: string): Promise<DecryptedKey | null> {
    const masterKey = await this.adapter.getMasterKey();
    const store = await this.adapter.readStore();

    const entry = store.keys.find((k) => {
      if (k.name !== name || k.isRevoked) return false;
      if (orgId && k.orgId !== orgId) return false;
      return true;
    });

    if (!entry) return null;

    /* Check expiration */
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) return null;

    const value = decrypt(entry.encryptedValue, entry.iv, masterKey);

    /* Update lastUsedAt */
    entry.lastUsedAt = new Date().toISOString();
    await this.adapter.writeStore(store);

    return {
      ...this.toMetadata(entry),
      value,
    };
  }

  /* ── List ────────────────────────────────────────────────── */

  async listKeys(orgId?: string): Promise<KeyMetadata[]> {
    const store = await this.adapter.readStore();

    const filtered = orgId
      ? store.keys.filter((k) => k.orgId === orgId)
      : store.keys;

    return filtered.map((e) => this.toMetadata(e));
  }

  /* ── Rotate ──────────────────────────────────────────────── */

  async rotateKey(name: string, newValue: string, orgId?: string): Promise<void> {
    const masterKey = await this.adapter.getMasterKey();
    const store = await this.adapter.readStore();

    const entry = store.keys.find((k) => {
      if (k.name !== name || k.isRevoked) return false;
      if (orgId && k.orgId !== orgId) return false;
      return true;
    });

    if (!entry) throw new Error(`Key "${name}" not found locally`);

    const { ciphertext, iv } = encrypt(newValue, masterKey);
    entry.encryptedValue = ciphertext;
    entry.iv = iv;

    await this.adapter.writeStore(store);
  }

  /* ── Revoke ──────────────────────────────────────────────── */

  async revokeKey(name: string, orgId?: string): Promise<void> {
    const store = await this.adapter.readStore();

    const entry = store.keys.find((k) => {
      if (k.name !== name) return false;
      if (orgId && k.orgId !== orgId) return false;
      return true;
    });

    if (!entry) throw new Error(`Key "${name}" not found locally`);

    entry.isRevoked = true;
    await this.adapter.writeStore(store);
  }

  /* ── Cloud sync ──────────────────────────────────────────── */

  /**
   * Sync metadata from cloud. Does NOT overwrite local keys.
   * If the same key name exists locally AND in cloud, local
   * takes precedence for reads (performance).
   *
   * This only records which keys are available in the cloud
   * so the UI can show "available remotely" indicators.
   */
  async syncFromCloud(cloudKeys: KeyMetadata[]): Promise<void> {
    const store = await this.adapter.readStore();
    const localNames = new Set(store.keys.map((k) => k.name));

    for (const ck of cloudKeys) {
      if (localNames.has(ck.name)) continue;

      /**
       * Store a metadata-only placeholder. The encryptedValue
       * is empty because we don't have the cloud master key.
       * Reads for this key will fall through to the cloud store.
       */
      store.keys.push({
        id: ck.id,
        name: ck.name,
        description: ck.description,
        keyType: ck.keyType,
        provider: ck.provider,
        storageMode: "cloud",
        workflowId: ck.workflowId,
        orgId: "", // Cloud-sourced metadata; no local org binding
        encryptedValue: "",
        iv: "",
        expiresAt: ck.expiresAt?.toISOString() ?? null,
        isRevoked: ck.isRevoked,
        lastUsedAt: ck.lastUsedAt?.toISOString() ?? null,
        createdAt: ck.createdAt?.toISOString() ?? new Date().toISOString(),
      });
    }

    await this.adapter.writeStore(store);
  }

  /**
   * Push local-only keys with storageMode='both' to the cloud.
   * Only pushes keys that don't yet exist in the cloud store.
   */
  async pushToCloud(cloudStore: CloudKeyStore, orgId: string): Promise<number> {
    const masterKey = await this.adapter.getMasterKey();
    const store = await this.adapter.readStore();

    const cloudKeys = await cloudStore.listKeys(orgId);
    const cloudNames = new Set(cloudKeys.map((k) => k.name));

    let pushed = 0;

    for (const entry of store.keys) {
      if (entry.storageMode !== "both") continue;
      if (entry.isRevoked) continue;
      if (entry.orgId !== orgId) continue;
      if (cloudNames.has(entry.name)) continue;

      /* Decrypt locally, then re-encrypt for cloud */
      const plaintext = decrypt(entry.encryptedValue, entry.iv, masterKey);

      await cloudStore.createKey({
        name: entry.name,
        value: plaintext,
        description: entry.description ?? undefined,
        keyType: entry.keyType,
        provider: entry.provider,
        storageMode: "both",
        workflowId: entry.workflowId ?? undefined,
        orgId,
      });

      pushed++;
    }

    return pushed;
  }

  /* ── Setup ───────────────────────────────────────────────── */

  /**
   * Initialize the local store with a fresh master key.
   * Call once during first-run setup.
   */
  async initialize(): Promise<string> {
    const key = generateEncryptionKey();
    await this.adapter.setMasterKey(key);
    await this.adapter.writeStore({ version: 1, keys: [] });
    return key;
  }

  /* ── Internal helpers ────────────────────────────────────── */

  private toMetadata(entry: EncryptedStoreEntry): KeyMetadata {
    return {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      keyType: entry.keyType,
      provider: entry.provider,
      storageMode: entry.storageMode,
      workflowId: entry.workflowId,
      lastUsedAt: entry.lastUsedAt ? new Date(entry.lastUsedAt) : null,
      expiresAt: entry.expiresAt ? new Date(entry.expiresAt) : null,
      isRevoked: entry.isRevoked,
      createdAt: entry.createdAt ? new Date(entry.createdAt) : null,
    };
  }
}

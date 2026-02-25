import type { EncryptedStore } from "./types.js";

/**
 * Platform-specific storage adapters for the local key store.
 *
 * Each adapter handles two concerns:
 *   1. Master key persistence (OS keychain / secure storage)
 *   2. Encrypted key file read/write (filesystem / AsyncStorage)
 *
 * The adapter interface is intentionally minimal so new platforms
 * (e.g. Tauri, React Native for Windows) are easy to add.
 */

export interface LocalStorageAdapter {
  /** Retrieve the local master key from the platform's secure storage. */
  getMasterKey(): Promise<string>;

  /** Persist the local master key into the platform's secure storage. */
  setMasterKey(key: string): Promise<void>;

  /** Read the encrypted key store (full file). */
  readStore(): Promise<EncryptedStore>;

  /** Write the encrypted key store (overwrites). */
  writeStore(store: EncryptedStore): Promise<void>;
}

/* ── Node / Electron adapter ─────────────────────────────────── */

/**
 * Desktop adapter using Electron's safeStorage for the master key
 * and a local JSON file for the encrypted store.
 *
 * When running outside Electron (e.g. standalone API server),
 * falls back to ENCRYPTION_MASTER_KEY env var and a temp file.
 *
 * NOTE: Full Electron integration requires IPC from the renderer
 * to the main process (safeStorage only works in main). This
 * implementation provides the interface contract; the Electron
 * app wires the IPC bridge at startup.
 */
export class NodeAdapter implements LocalStorageAdapter {
  private masterKey: string | null = null;

  constructor(
    private readonly storePath: string,
    private readonly envFallbackKey?: string,
  ) {}

  async getMasterKey(): Promise<string> {
    if (this.masterKey) return this.masterKey;

    /**
     * In Electron main process:
     *   const { safeStorage } = require('electron');
     *   return safeStorage.decryptString(readFileSync(keyPath));
     *
     * Outside Electron, use env var fallback:
     */
    const envKey = this.envFallbackKey ?? process.env["ENCRYPTION_MASTER_KEY"];
    if (envKey) {
      this.masterKey = envKey;
      return envKey;
    }

    throw new Error(
      "No master key available. Set ENCRYPTION_MASTER_KEY or run inside Electron.",
    );
  }

  async setMasterKey(key: string): Promise<void> {
    /**
     * In Electron:
     *   const encrypted = safeStorage.encryptString(key);
     *   writeFileSync(keyPath, encrypted);
     */
    this.masterKey = key;
  }

  async readStore(): Promise<EncryptedStore> {
    try {
      const { readFileSync } = await import("node:fs");
      const data = readFileSync(this.storePath, "utf-8");
      return JSON.parse(data) as EncryptedStore;
    } catch {
      /* File doesn't exist yet — return empty store */
      return { version: 1, keys: [] };
    }
  }

  async writeStore(store: EncryptedStore): Promise<void> {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    mkdirSync(dirname(this.storePath), { recursive: true });
    writeFileSync(this.storePath, JSON.stringify(store, null, 2), "utf-8");
  }
}

/* ── Mobile adapter ───────────────────────────────────────────── */

/**
 * Mobile adapter using expo-secure-store for the master key
 * and the device's secure storage for the encrypted store.
 *
 * NOTE: expo-secure-store must be available at runtime.
 * This class provides the contract; the React Native app
 * supplies the actual SecureStore module at construction.
 */
export class MobileAdapter implements LocalStorageAdapter {
  constructor(
    private readonly secureStore: {
      getItemAsync(key: string): Promise<string | null>;
      setItemAsync(key: string, value: string): Promise<void>;
    },
    private readonly masterKeyName = "vsync_master_key",
    private readonly storeKeyName = "vsync_key_store",
  ) {}

  async getMasterKey(): Promise<string> {
    const key = await this.secureStore.getItemAsync(this.masterKeyName);
    if (!key) {
      throw new Error("Master key not found in secure storage. Run initial setup first.");
    }
    return key;
  }

  async setMasterKey(key: string): Promise<void> {
    await this.secureStore.setItemAsync(this.masterKeyName, key);
  }

  async readStore(): Promise<EncryptedStore> {
    const data = await this.secureStore.getItemAsync(this.storeKeyName);
    if (!data) return { version: 1, keys: [] };
    return JSON.parse(data) as EncryptedStore;
  }

  async writeStore(store: EncryptedStore): Promise<void> {
    await this.secureStore.setItemAsync(this.storeKeyName, JSON.stringify(store));
  }
}

/* ── Memory adapter (testing / cloud-only) ────────────────────── */

/**
 * In-memory adapter with no persistence.
 * Used in tests and cloud-only deployments where local
 * storage is unnecessary.
 */
export class MemoryAdapter implements LocalStorageAdapter {
  private masterKey: string | null = null;
  private store: EncryptedStore = { version: 1, keys: [] };

  async getMasterKey(): Promise<string> {
    if (!this.masterKey) {
      throw new Error("Master key not set. Call setMasterKey() first.");
    }
    return this.masterKey;
  }

  async setMasterKey(key: string): Promise<void> {
    this.masterKey = key;
  }

  async readStore(): Promise<EncryptedStore> {
    /* Return a deep copy to prevent mutation */
    return JSON.parse(JSON.stringify(this.store)) as EncryptedStore;
  }

  async writeStore(store: EncryptedStore): Promise<void> {
    this.store = JSON.parse(JSON.stringify(store)) as EncryptedStore;
  }
}

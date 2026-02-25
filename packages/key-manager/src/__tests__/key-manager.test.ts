import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import * as dbExports from "@vsync/db";
import { UserRepository, OrgRepository } from "@vsync/db";
import type { Database } from "@vsync/db";

import {
  encrypt,
  decrypt,
  generateEncryptionKey,
  hashKeyName,
} from "../crypto.js";
import { CloudKeyStore } from "../cloud-store.js";
import { LocalKeyStore } from "../local-store.js";
import { KeyResolver } from "../key-resolver.js";
import { MemoryAdapter } from "../adapters.js";
import type { CreateKeyOpts, KeyMetadata } from "../types.js";

/**
 * Key Manager integration tests.
 *
 * Uses PGlite (in-memory Postgres) for CloudKeyStore tests,
 * MemoryAdapter for LocalKeyStore tests, and both for
 * KeyResolver integration.
 */

let pglite: PGlite;
let db: Database;
let masterKey: string;
let testOrgId: string;
let testUserId: string;

/* ── Database setup ────────────────────────────────────────────── */

beforeAll(async () => {
  pglite = new PGlite();
  db = drizzle(pglite, { schema: dbExports }) as unknown as Database;

  /* Generate a deterministic master key for test reproducibility */
  masterKey = generateEncryptionKey();

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

  await db.execute(sql`
    CREATE TABLE workflows (
      id TEXT PRIMARY KEY,
      org_id UUID NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL,
      description TEXT,
      active_version INT DEFAULT 0,
      is_locked BOOLEAN DEFAULT false,
      locked_by TEXT,
      is_disabled BOOLEAN DEFAULT false,
      is_public BOOLEAN DEFAULT false,
      created_by UUID REFERENCES users(id),
      updated_by UUID,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE keys (
      id TEXT PRIMARY KEY,
      org_id UUID NOT NULL REFERENCES organizations(id),
      workflow_id TEXT REFERENCES workflows(id),
      name TEXT NOT NULL,
      description TEXT,
      provider TEXT NOT NULL DEFAULT 'custom',
      key_type TEXT NOT NULL DEFAULT 'api_key',
      encrypted_value TEXT NOT NULL,
      iv TEXT NOT NULL,
      algorithm TEXT DEFAULT 'aes-256-gcm',
      storage_mode TEXT DEFAULT 'cloud',
      last_used_at TIMESTAMP,
      last_rotated_at TIMESTAMP,
      expires_at TIMESTAMP,
      is_revoked BOOLEAN DEFAULT false,
      metadata JSONB,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),
      UNIQUE(org_id, name)
    )
  `);

  await db.execute(sql`
    CREATE TABLE key_audit_log (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      key_id TEXT NOT NULL REFERENCES keys(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      performed_by UUID REFERENCES users(id),
      ip_address TEXT,
      user_agent TEXT,
      metadata JSONB,
      created_at TIMESTAMP DEFAULT now()
    )
  `);

  /* Seed test data */
  const userRepo = new UserRepository(db);
  const orgRepo = new OrgRepository(db);

  const user = await userRepo.create({
    email: "keytester@vsync.io",
    name: "Key Tester",
  });
  testUserId = user.id;

  const org = await orgRepo.create({
    name: "Key Test Org",
    slug: "key-test-org",
  });
  testOrgId = org.id;

  await orgRepo.addMember(org.id, user.id, "owner");
});

afterAll(async () => {
  await pglite.close();
});

/* ── Crypto ─────────────────────────────────────────────────────── */

describe("Crypto", () => {
  it("generates a 64-char hex encryption key", () => {
    const key = generateEncryptionKey();
    expect(key).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
  });

  it("encrypt/decrypt roundtrip succeeds", () => {
    const key = generateEncryptionKey();
    const plaintext = "sk-abc123-super-secret-api-key";

    const { ciphertext, iv } = encrypt(plaintext, key);
    const decrypted = decrypt(ciphertext, iv, key);

    expect(decrypted).toBe(plaintext);
  });

  it("encrypt/decrypt works with various key sizes and special chars", () => {
    const key = generateEncryptionKey();

    const testCases = [
      "", // empty string
      "a", // single char
      "Hello, World! 🔑", // Unicode + emoji
      "x".repeat(10000), // large value
      '{"token": "abc", "secret": 123}', // JSON-like
      "line1\nline2\ttab", // whitespace chars
    ];

    for (const plaintext of testCases) {
      const { ciphertext, iv } = encrypt(plaintext, key);
      const decrypted = decrypt(ciphertext, iv, key);
      expect(decrypted).toBe(plaintext);
    }
  });

  it("ciphertext differs for same plaintext (random IV)", () => {
    const key = generateEncryptionKey();
    const plaintext = "same-value";

    const result1 = encrypt(plaintext, key);
    const result2 = encrypt(plaintext, key);

    expect(result1.ciphertext).not.toBe(result2.ciphertext);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it("decryption fails with wrong master key", () => {
    const key1 = generateEncryptionKey();
    const key2 = generateEncryptionKey();
    const plaintext = "secret";

    const { ciphertext, iv } = encrypt(plaintext, key1);

    expect(() => decrypt(ciphertext, iv, key2)).toThrow();
  });

  it("rejects invalid master key length", () => {
    /* Use valid hex that's too short (16 bytes instead of 32) */
    const shortHex = "aa".repeat(16);
    expect(() => encrypt("hello", shortHex)).toThrow(/Master key must be/);
    expect(() => decrypt("aabb", "ccdd", shortHex)).toThrow(/Master key must be/);
  });

  it("hashKeyName produces consistent results", () => {
    const h1 = hashKeyName("my_api_key");
    const h2 = hashKeyName("my_api_key");
    expect(h1).toBe(h2);
  });

  it("hashKeyName produces different hashes for different names", () => {
    const h1 = hashKeyName("key_a");
    const h2 = hashKeyName("key_b");
    expect(h1).not.toBe(h2);
  });
});

/* ── CloudKeyStore ──────────────────────────────────────────────── */

describe("CloudKeyStore", () => {
  let store: CloudKeyStore;

  beforeAll(() => {
    store = new CloudKeyStore(db, masterKey);
  });

  const baseOpts: CreateKeyOpts = {
    name: "openai_key",
    value: "sk-test-openai-abc123",
    description: "OpenAI API key for GPT-4",
    keyType: "api_key",
    provider: "openai",
    storageMode: "cloud",
    orgId: "", // will be set in each test
  };

  it("creates a key and returns metadata without value", async () => {
    const opts = { ...baseOpts, orgId: testOrgId, name: "create_test" };
    const meta = await store.createKey(opts, testUserId);

    expect(meta.id).toBeDefined();
    expect(meta.name).toBe("create_test");
    expect(meta.provider).toBe("openai");
    expect(meta.keyType).toBe("api_key");
    expect(meta.isRevoked).toBe(false);
    /* No value on KeyMetadata */
    expect("value" in meta).toBe(false);
  });

  it("rejects duplicate key names in the same scope", async () => {
    const opts = { ...baseOpts, orgId: testOrgId, name: "dup_test" };
    await store.createKey(opts, testUserId);

    await expect(store.createKey(opts, testUserId)).rejects.toThrow(/already exists/);
  });

  it("retrieves and decrypts a key by name", async () => {
    const opts = {
      ...baseOpts,
      orgId: testOrgId,
      name: "get_test",
      value: "my-super-secret-value",
    };
    await store.createKey(opts, testUserId);

    const key = await store.getKey(testOrgId, "get_test");
    expect(key).not.toBeNull();
    expect(key?.value).toBe("my-super-secret-value");
    expect(key?.name).toBe("get_test");
  });

  it("returns null for non-existent key", async () => {
    const key = await store.getKey(testOrgId, "does_not_exist");
    expect(key).toBeNull();
  });

  it("lists keys as metadata only", async () => {
    const keys = await store.listKeys(testOrgId);
    expect(keys.length).toBeGreaterThanOrEqual(1);

    for (const k of keys) {
      expect("value" in k).toBe(false);
      expect(k.name).toBeDefined();
      expect(k.provider).toBeDefined();
    }
  });

  it("rotates a key with a new value", async () => {
    const opts = {
      ...baseOpts,
      orgId: testOrgId,
      name: "rotate_test",
      value: "old-secret",
    };
    const meta = await store.createKey(opts, testUserId);

    await store.rotateKey(meta.id, "new-secret", testUserId);

    const updated = await store.getKey(testOrgId, "rotate_test");
    expect(updated?.value).toBe("new-secret");
  });

  it("old value is gone after rotation", async () => {
    /* Use the key from the rotation test above */
    const key = await store.getKey(testOrgId, "rotate_test");
    expect(key?.value).not.toBe("old-secret");
    expect(key?.value).toBe("new-secret");
  });

  it("revokes a key so getKey returns null", async () => {
    const opts = {
      ...baseOpts,
      orgId: testOrgId,
      name: "revoke_test",
      value: "will-be-revoked",
    };
    const meta = await store.createKey(opts, testUserId);

    await store.revokeKey(meta.id, testUserId);

    const key = await store.getKey(testOrgId, "revoke_test");
    expect(key).toBeNull();
  });

  it("returns null for expired keys", async () => {
    const opts = {
      ...baseOpts,
      orgId: testOrgId,
      name: "expired_test",
      value: "ephemeral",
      expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
    };
    await store.createKey(opts, testUserId);

    const key = await store.getKey(testOrgId, "expired_test");
    expect(key).toBeNull();
  });

  it("records audit log for key operations", async () => {
    const opts = {
      ...baseOpts,
      orgId: testOrgId,
      name: "audit_test",
      value: "audit-me",
    };
    const meta = await store.createKey(opts, testUserId);

    /* Access the key (creates an "accessed" audit entry) */
    await store.getKey(testOrgId, "audit_test", undefined, testUserId);

    const log = await store.getAuditLog(meta.id);
    expect(log.length).toBeGreaterThanOrEqual(2);

    const actions = log.map((e) => e.action);
    expect(actions).toContain("created");
    expect(actions).toContain("accessed");
  });
});

/* ── LocalKeyStore ──────────────────────────────────────────────── */

describe("LocalKeyStore", () => {
  let localStore: LocalKeyStore;
  let adapter: MemoryAdapter;
  let localMasterKey: string;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    localStore = new LocalKeyStore(adapter);
    localMasterKey = await localStore.initialize();
  });

  const baseOpts: CreateKeyOpts = {
    name: "local_secret",
    value: "local-api-key-123",
    keyType: "api_key",
    provider: "custom",
    storageMode: "local",
    orgId: "org-local-test",
  };

  it("initializes with a fresh master key", async () => {
    expect(localMasterKey).toHaveLength(64);
    const stored = await adapter.getMasterKey();
    expect(stored).toBe(localMasterKey);
  });

  it("creates and retrieves a local key", async () => {
    const meta = await localStore.createKey(baseOpts);
    expect(meta.name).toBe("local_secret");

    const key = await localStore.getKey("local_secret", "org-local-test");
    expect(key?.value).toBe("local-api-key-123");
  });

  it("rejects duplicate local keys", async () => {
    await localStore.createKey(baseOpts);
    await expect(localStore.createKey(baseOpts)).rejects.toThrow(/already exists/);
  });

  it("lists local keys", async () => {
    await localStore.createKey(baseOpts);
    await localStore.createKey({
      ...baseOpts,
      name: "second_key",
      value: "val2",
    });

    const keys = await localStore.listKeys("org-local-test");
    expect(keys).toHaveLength(2);
  });

  it("rotates a local key", async () => {
    await localStore.createKey(baseOpts);

    await localStore.rotateKey("local_secret", "rotated-value", "org-local-test");

    const key = await localStore.getKey("local_secret", "org-local-test");
    expect(key?.value).toBe("rotated-value");
  });

  it("revokes a local key", async () => {
    await localStore.createKey(baseOpts);

    await localStore.revokeKey("local_secret", "org-local-test");

    const key = await localStore.getKey("local_secret", "org-local-test");
    expect(key).toBeNull();
  });

  it("returns null for expired local keys", async () => {
    await localStore.createKey({
      ...baseOpts,
      name: "expired_local",
      expiresAt: new Date(Date.now() - 1000),
    });

    const key = await localStore.getKey("expired_local", "org-local-test");
    expect(key).toBeNull();
  });
});

/* ── KeyResolver ────────────────────────────────────────────────── */

describe("KeyResolver", () => {
  let cloudStore: CloudKeyStore;
  let localStore: LocalKeyStore;
  let resolver: KeyResolver;

  beforeAll(async () => {
    cloudStore = new CloudKeyStore(db, masterKey);
    const adapter = new MemoryAdapter();
    localStore = new LocalKeyStore(adapter);
    await localStore.initialize();

    /* Seed a cloud key */
    try {
      await cloudStore.createKey({
        name: "cloud_only_key",
        value: "cloud-secret-val",
        keyType: "api_key",
        provider: "openai",
        storageMode: "cloud",
        orgId: testOrgId,
      });
    } catch {
      /* May already exist from previous test run */
    }

    /* Seed a local key */
    await localStore.createKey({
      name: "local_only_key",
      value: "local-secret-val",
      keyType: "api_key",
      provider: "custom",
      storageMode: "local",
      orgId: testOrgId,
    });

    /* Seed a key that exists in both stores */
    try {
      await cloudStore.createKey({
        name: "both_key",
        value: "cloud-both-val",
        keyType: "api_key",
        provider: "custom",
        storageMode: "both",
        orgId: testOrgId,
      });
    } catch {
      /* May already exist */
    }

    await localStore.createKey({
      name: "both_key",
      value: "local-both-val",
      keyType: "api_key",
      provider: "custom",
      storageMode: "both",
      orgId: testOrgId,
    });

    resolver = new KeyResolver(cloudStore, localStore);
  });

  const ctx = { orgId: "", workflowId: undefined };

  it("resolves $keys.local.* from local store only", async () => {
    ctx.orgId = testOrgId;
    const val = await resolver.resolve("$keys.local.local_only_key", ctx);
    expect(val).toBe("local-secret-val");
  });

  it("resolves $keys.cloud.* from cloud store only", async () => {
    ctx.orgId = testOrgId;
    const val = await resolver.resolve("$keys.cloud.cloud_only_key", ctx);
    expect(val).toBe("cloud-secret-val");
  });

  it("default resolution prefers local over cloud", async () => {
    ctx.orgId = testOrgId;
    const val = await resolver.resolve("$keys.both_key", ctx);
    /* Local takes precedence */
    expect(val).toBe("local-both-val");
  });

  it("default resolution falls back to cloud when not in local", async () => {
    ctx.orgId = testOrgId;
    const val = await resolver.resolve("$keys.cloud_only_key", ctx);
    expect(val).toBe("cloud-secret-val");
  });

  it("throws for non-existent keys", async () => {
    ctx.orgId = testOrgId;
    await expect(
      resolver.resolve("$keys.nope_not_here", ctx),
    ).rejects.toThrow(/not found/);
  });

  it("throws for $keys.local.* when key doesn't exist locally", async () => {
    ctx.orgId = testOrgId;
    await expect(
      resolver.resolve("$keys.local.cloud_only_key", ctx),
    ).rejects.toThrow(/not found in local store/);
  });

  it("throws for $keys.cloud.* when key doesn't exist in cloud", async () => {
    ctx.orgId = testOrgId;
    await expect(
      resolver.resolve("$keys.cloud.local_only_key", ctx),
    ).rejects.toThrow(/not found in cloud store/);
  });

  it("resolveAll batch-resolves multiple refs", async () => {
    ctx.orgId = testOrgId;
    const results = await resolver.resolveAll(
      ["$keys.local.local_only_key", "$keys.cloud.cloud_only_key"],
      ctx,
    );

    expect(results.size).toBe(2);
    expect(results.get("$keys.local.local_only_key")).toBe("local-secret-val");
    expect(results.get("$keys.cloud.cloud_only_key")).toBe("cloud-secret-val");
  });

  it("resolver works with cloud-only config", async () => {
    const cloudOnlyResolver = new KeyResolver(cloudStore, undefined);
    ctx.orgId = testOrgId;
    const val = await cloudOnlyResolver.resolve("$keys.cloud_only_key", ctx);
    expect(val).toBe("cloud-secret-val");
  });

  it("resolver works with local-only config", async () => {
    const localOnlyResolver = new KeyResolver(undefined, localStore);
    ctx.orgId = testOrgId;
    const val = await localOnlyResolver.resolve("$keys.local_only_key", ctx);
    expect(val).toBe("local-secret-val");
  });
});

/* ── MemoryAdapter ──────────────────────────────────────────────── */

describe("MemoryAdapter", () => {
  it("throws when master key not set", async () => {
    const adapter = new MemoryAdapter();
    await expect(adapter.getMasterKey()).rejects.toThrow(/not set/);
  });

  it("set and get master key", async () => {
    const adapter = new MemoryAdapter();
    await adapter.setMasterKey("abc123");
    const key = await adapter.getMasterKey();
    expect(key).toBe("abc123");
  });

  it("returns empty store by default", async () => {
    const adapter = new MemoryAdapter();
    const store = await adapter.readStore();
    expect(store.version).toBe(1);
    expect(store.keys).toHaveLength(0);
  });

  it("write and read store are independent (deep copy)", async () => {
    const adapter = new MemoryAdapter();
    const store = { version: 1, keys: [] as never[] };
    await adapter.writeStore(store);

    store.keys.push("mutated" as never);
    const read = await adapter.readStore();
    expect(read.keys).toHaveLength(0);
  });
});

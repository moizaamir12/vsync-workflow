import { gcm } from "@noble/ciphers/aes";
import { randomBytes } from "@noble/ciphers/webcrypto";
import { bytesToHex, hexToBytes, utf8ToBytes, bytesToUtf8 } from "@noble/ciphers/utils";
import type { EncryptedPayload } from "./types.js";

/**
 * AES-256-GCM encryption and decryption utilities.
 *
 * Built on @noble/ciphers — a pure-JS, audited, zero-dependency
 * library that works identically in Node.js, browsers, and
 * React Native. No platform-specific crypto APIs required.
 *
 * All inputs/outputs are hex-encoded strings for safe storage
 * in JSON, environment variables, and database text columns.
 */

const KEY_BYTES = 32; // 256 bits
const IV_BYTES = 12; // 96-bit nonce (recommended for GCM)

/* ── Key generation ────────────────────────────────────────── */

/**
 * Generate a fresh 256-bit encryption key as a hex string.
 * Suitable for use as ENCRYPTION_MASTER_KEY env var.
 */
export function generateEncryptionKey(): string {
  return bytesToHex(randomBytes(KEY_BYTES));
}

/* ── Encrypt / Decrypt ─────────────────────────────────────── */

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @param plaintext  — the secret value to encrypt
 * @param masterKey  — 64-char hex string (256 bits)
 * @returns ciphertext and iv, both hex-encoded
 */
export function encrypt(plaintext: string, masterKey: string): EncryptedPayload {
  const keyBytes = hexToBytes(masterKey);
  if (keyBytes.length !== KEY_BYTES) {
    throw new Error(`Master key must be ${KEY_BYTES * 2} hex chars (${KEY_BYTES} bytes)`);
  }

  const iv = randomBytes(IV_BYTES);
  const cipher = gcm(keyBytes, iv);
  const ciphertext = cipher.encrypt(utf8ToBytes(plaintext));

  return {
    ciphertext: bytesToHex(ciphertext),
    iv: bytesToHex(iv),
  };
}

/**
 * Decrypt a ciphertext string using AES-256-GCM.
 *
 * @param ciphertext — hex-encoded ciphertext (includes GCM auth tag)
 * @param iv         — hex-encoded 12-byte nonce
 * @param masterKey  — 64-char hex string (256 bits)
 * @returns the original plaintext
 * @throws if auth tag verification fails (wrong key or tampered data)
 */
export function decrypt(ciphertext: string, iv: string, masterKey: string): string {
  const keyBytes = hexToBytes(masterKey);
  if (keyBytes.length !== KEY_BYTES) {
    throw new Error(`Master key must be ${KEY_BYTES * 2} hex chars (${KEY_BYTES} bytes)`);
  }

  const cipher = gcm(keyBytes, hexToBytes(iv));
  const plainBytes = cipher.decrypt(hexToBytes(ciphertext));
  return bytesToUtf8(plainBytes);
}

/* ── Hashing ───────────────────────────────────────────────── */

/**
 * Hash a key name for safe lookup without exposing it.
 *
 * Uses a simple non-cryptographic hash (FNV-1a) since the purpose
 * is obfuscation in logs/indices, not security. The name itself
 * is stored encrypted alongside the value.
 */
export function hashKeyName(name: string): string {
  /* FNV-1a 64-bit, truncated to 32 hex chars */
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  /* Convert signed int32 to unsigned hex */
  return (h >>> 0).toString(16).padStart(8, "0");
}

/* ── Master key resolution ─────────────────────────────────── */

/**
 * Resolve the master encryption key from the environment.
 *
 * If ENCRYPTION_MASTER_KEY is not set, generates a new key and
 * logs it to the console ONCE with instructions to persist it.
 * In production, replace with a KMS-derived key.
 */
export function resolveMasterKey(): string {
  const envKey = process.env["ENCRYPTION_MASTER_KEY"];
  if (envKey && envKey.length === KEY_BYTES * 2) {
    return envKey;
  }

  const generated = generateEncryptionKey();
  console.warn(
    `[key-manager] ⚠ ENCRYPTION_MASTER_KEY not found or invalid.\n` +
    `  Generated a new master key for this session:\n` +
    `  ENCRYPTION_MASTER_KEY=${generated}\n` +
    `  Save this in your .env file or secrets manager.\n` +
    `  Keys encrypted with this key will be unrecoverable without it.`,
  );
  return generated;
}

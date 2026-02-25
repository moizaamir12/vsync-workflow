import type { CloudKeyStore } from "./cloud-store.js";
import type { LocalKeyStore } from "./local-store.js";

/**
 * Resolution context passed by the workflow engine.
 * Contains the org and optional workflow scope for key lookups.
 */
export interface ResolveContext {
  orgId: string;
  workflowId?: string;
}

/**
 * Unified key resolver for the workflow engine.
 *
 * Blocks reference secrets with `$keys.my_api_key` expressions.
 * The resolver parses the reference, checks local and cloud
 * stores in the correct order, and returns the plaintext value.
 *
 * Resolution rules:
 *   - `$keys.local.my_secret`  → local store only
 *   - `$keys.cloud.my_api_key` → cloud store only
 *   - `$keys.my_api_key`       → local first, then cloud
 *
 * Throws if the key is not found, revoked, or expired.
 */
export class KeyResolver {
  constructor(
    private readonly cloudStore?: CloudKeyStore,
    private readonly localStore?: LocalKeyStore,
  ) {}

  /**
   * Resolve a single key reference to its plaintext value.
   *
   * @param keyRef  — e.g. "$keys.my_api_key" or "$keys.local.token"
   * @param context — org and workflow scope
   * @returns the decrypted secret value
   * @throws if the key cannot be resolved
   */
  async resolve(keyRef: string, context: ResolveContext): Promise<string> {
    const parsed = this.parseRef(keyRef);

    switch (parsed.scope) {
      case "local":
        return this.resolveLocal(parsed.name, context);

      case "cloud":
        return this.resolveCloud(parsed.name, context);

      case "default":
        return this.resolveDefault(parsed.name, context);
    }
  }

  /**
   * Batch resolve multiple key references for efficiency.
   * Returns a Map from reference string to plaintext value.
   * Throws on the first unresolvable key.
   */
  async resolveAll(
    refs: string[],
    context: ResolveContext,
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    /* Resolve concurrently where possible */
    const entries = await Promise.all(
      refs.map(async (ref) => {
        const value = await this.resolve(ref, context);
        return [ref, value] as const;
      }),
    );

    for (const [ref, value] of entries) {
      results.set(ref, value);
    }

    return results;
  }

  /* ── Internal resolution strategies ─────────────────────── */

  private async resolveLocal(name: string, context: ResolveContext): Promise<string> {
    if (!this.localStore) {
      throw new Error(`Local store not available; cannot resolve "$keys.local.${name}"`);
    }

    const key = await this.localStore.getKey(name, context.orgId);
    if (!key) {
      throw new Error(`Key "${name}" not found in local store`);
    }

    return key.value;
  }

  private async resolveCloud(name: string, context: ResolveContext): Promise<string> {
    if (!this.cloudStore) {
      throw new Error(`Cloud store not available; cannot resolve "$keys.cloud.${name}"`);
    }

    const key = await this.cloudStore.getKey(
      context.orgId,
      name,
      context.workflowId,
    );
    if (!key) {
      throw new Error(`Key "${name}" not found in cloud store`);
    }

    return key.value;
  }

  /**
   * Default resolution: check local first (faster, no network),
   * then fall back to cloud.
   */
  private async resolveDefault(name: string, context: ResolveContext): Promise<string> {
    /* Try local first */
    if (this.localStore) {
      const localKey = await this.localStore.getKey(name, context.orgId);
      if (localKey) return localKey.value;
    }

    /* Fall back to cloud */
    if (this.cloudStore) {
      const cloudKey = await this.cloudStore.getKey(
        context.orgId,
        name,
        context.workflowId,
      );
      if (cloudKey) return cloudKey.value;
    }

    throw new Error(
      `Key "${name}" not found in any store (checked: ${[
        this.localStore ? "local" : null,
        this.cloudStore ? "cloud" : null,
      ]
        .filter(Boolean)
        .join(", ")})`,
    );
  }

  /* ── Reference parsing ──────────────────────────────────── */

  private parseRef(keyRef: string): { scope: "local" | "cloud" | "default"; name: string } {
    /* Strip the $keys. prefix if present */
    const stripped = keyRef.startsWith("$keys.")
      ? keyRef.slice(6)
      : keyRef;

    if (stripped.startsWith("local.")) {
      return { scope: "local", name: stripped.slice(6) };
    }

    if (stripped.startsWith("cloud.")) {
      return { scope: "cloud", name: stripped.slice(6) };
    }

    return { scope: "default", name: stripped };
  }
}

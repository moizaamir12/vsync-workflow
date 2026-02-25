import type { WorkflowContext } from "@vsync/shared-types";

/**
 * Variable resolution engine for workflow template expressions.
 *
 * Supports 14 `$` prefixes that map into different parts of
 * the WorkflowContext. Handles dot-path access, bracket notation,
 * and string interpolation via `{{expr}}` templates.
 *
 * Resolution rules:
 *   $state.orderId        → context.state["orderId"]
 *   $cache.tempResult     → context.cache.get("tempResult")
 *   $artifacts            → context.artifacts (array)
 *   $secrets.apiKey       → context.secrets["apiKey"]
 *   $paths.tempDir        → context.paths["tempDir"]
 *   $event.type           → context.event["type"]
 *   $run.id               → context.run["id"]
 *   $error.message        → last step error message (set externally)
 *   $now                  → ISO-8601 current timestamp
 *   $keys.my_api_key      → context.keyResolver?.("my_api_key")
 *   $loop.<id>.index      → context.loops[id].index
 *   $row                  → current loop artifact (alias)
 *   $item                 → current loop item (alias)
 *   $index                → current loop index (alias)
 */
export class ContextManager {
  private lastError: { message: string; stack?: string; blockId: string; blockName: string } | null = null;

  /** Store the last step error so $error references work */
  setLastError(error: { message: string; stack?: string; blockId: string; blockName: string } | null): void {
    this.lastError = error;
  }

  /**
   * Resolve a single `$`-prefixed expression against the context.
   *
   * @param expr    — e.g. "$state.user.name" or "$loop.myLoop.index"
   * @param context — the current workflow context
   * @returns the resolved value, or undefined if not found
   */
  resolve(expr: string, context: WorkflowContext): unknown {
    const trimmed = expr.trim();
    if (!trimmed.startsWith("$")) return trimmed;

    /* Strip the leading $ */
    const path = trimmed.slice(1);

    /* Split on dots, respecting bracket notation */
    const segments = this.parsePath(path);
    if (segments.length === 0) return undefined;

    const prefix = segments[0];
    const rest = segments.slice(1);

    const root = this.resolvePrefix(prefix, rest, context);
    if (rest.length === 0) return root;

    return this.walkPath(root, rest);
  }

  /**
   * Interpolate all `{{expr}}` placeholders in a template string.
   *
   * @param template — e.g. "Hello {{$state.name}}, your order is {{$state.orderId}}"
   * @param context  — the current workflow context
   * @returns the interpolated string
   */
  interpolate(template: string, context: WorkflowContext): string {
    return template.replace(/\{\{(.+?)\}\}/g, (_match, expr: string) => {
      const resolved = this.resolve(expr.trim(), context);
      if (resolved === undefined || resolved === null) return "";
      return String(resolved);
    });
  }

  /**
   * Resolve a value that may be a `$`-expression, a `{{template}}`,
   * or a plain literal. Provides a single entry point for block
   * logic values that could be any of the three forms.
   */
  resolveValue(value: unknown, context: WorkflowContext): unknown {
    if (typeof value !== "string") return value;
    if (value.startsWith("$")) return this.resolve(value, context);
    if (value.includes("{{")) return this.interpolate(value, context);
    return value;
  }

  /* ── Internal: prefix resolution ─────────────────────── */

  private resolvePrefix(
    prefix: string,
    rest: string[],
    context: WorkflowContext,
  ): unknown {
    switch (prefix) {
      case "state":
        return context.state;

      case "cache":
        /* Cache is a Map — resolve first key via .get() */
        if (rest.length > 0) {
          const cacheKey = rest[0];
          const cacheVal = context.cache.get(cacheKey);
          /* Consume the first rest segment since we used it */
          rest.splice(0, 1);
          return cacheVal;
        }
        return context.cache;

      case "artifacts":
        return context.artifacts;

      case "secrets":
        return context.secrets;

      case "paths":
        return context.paths;

      case "event":
        return context.event;

      case "run":
        return context.run;

      case "error":
        return this.lastError ?? {};

      case "now":
        return new Date().toISOString();

      case "keys":
        /* Delegate to keyResolver — join remaining path as the key name */
        if (context.keyResolver && rest.length > 0) {
          const keyName = rest.join(".");
          rest.splice(0, rest.length);
          return context.keyResolver(keyName);
        }
        return undefined;

      case "loop":
        /* $loop.<loopId>.index etc */
        if (rest.length > 0) {
          const loopId = rest[0];
          const loopCtx = context.loops[loopId];
          rest.splice(0, 1);
          return loopCtx;
        }
        return context.loops;

      case "row":
        return this.getCurrentLoopArtifact(context);

      case "item":
        return this.getCurrentLoopItem(context);

      case "index":
        return this.getCurrentLoopIndex(context);

      default:
        return undefined;
    }
  }

  /* ── Internal: loop aliases ──────────────────────────── */

  /** Get the artifact from the most recently active loop */
  private getCurrentLoopArtifact(context: WorkflowContext): unknown {
    const loopIds = Object.keys(context.loops);
    if (loopIds.length === 0) return undefined;
    const lastLoop = context.loops[loopIds[loopIds.length - 1]];
    return lastLoop?.artifact;
  }

  /** Get the current item (artifact) from the active loop */
  private getCurrentLoopItem(context: WorkflowContext): unknown {
    return this.getCurrentLoopArtifact(context);
  }

  /** Get the current index from the most recently active loop */
  private getCurrentLoopIndex(context: WorkflowContext): unknown {
    const loopIds = Object.keys(context.loops);
    if (loopIds.length === 0) return undefined;
    const lastLoop = context.loops[loopIds[loopIds.length - 1]];
    return lastLoop?.index;
  }

  /* ── Internal: path parsing and walking ──────────────── */

  /**
   * Parse a dot-path that may contain bracket notation.
   * "user.addresses[0].city" → ["user", "addresses", "0", "city"]
   */
  private parsePath(path: string): string[] {
    const segments: string[] = [];
    let current = "";

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === ".") {
        if (current) segments.push(current);
        current = "";
      } else if (char === "[") {
        if (current) segments.push(current);
        current = "";

        /* Read until closing bracket */
        const closingIdx = path.indexOf("]", i + 1);
        if (closingIdx === -1) {
          /* Malformed bracket — treat rest as literal */
          current = path.slice(i);
          break;
        }

        let bracketContent = path.slice(i + 1, closingIdx);

        /* Strip quotes from bracket content */
        if (
          (bracketContent.startsWith("\"") && bracketContent.endsWith("\"")) ||
          (bracketContent.startsWith("'") && bracketContent.endsWith("'"))
        ) {
          bracketContent = bracketContent.slice(1, -1);
        }

        segments.push(bracketContent);
        i = closingIdx;
      } else {
        current += char;
      }
    }

    if (current) segments.push(current);
    return segments;
  }

  /** Walk a nested object/array by path segments */
  private walkPath(root: unknown, segments: string[]): unknown {
    let current = root;

    for (const segment of segments) {
      if (current === null || current === undefined) return undefined;

      if (Array.isArray(current)) {
        const idx = Number(segment);
        if (Number.isNaN(idx)) return undefined;
        current = current[idx];
      } else if (typeof current === "object") {
        current = (current as Record<string, unknown>)[segment];
      } else {
        return undefined;
      }
    }

    return current;
  }
}

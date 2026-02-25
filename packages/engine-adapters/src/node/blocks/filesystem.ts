import fs from "node:fs/promises";
import path from "node:path";
import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "@vsync/engine";
import { ContextManager } from "@vsync/engine";

/**
 * Node.js filesystem block executor.
 *
 * Operations: read, write, delete, exists, list, mkdir, append
 * All paths are validated to prevent directory traversal attacks.
 */
export async function nodeFilesystemExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  const operation = String(cm.resolveValue(logic.filesystem_operation, context) ?? "");
  const rawPath = String(cm.resolveValue(logic.filesystem_path, context) ?? "");

  if (!operation) throw new Error("filesystem_operation is required");
  if (!rawPath) throw new Error("filesystem_path is required");

  /* Validate path — prevent directory traversal */
  const safePath = validatePath(rawPath);

  let result: unknown;

  switch (operation) {
    case "read":
      result = await executeRead(cm, safePath, logic, context);
      break;
    case "write":
      result = await executeWrite(cm, safePath, logic, context);
      break;
    case "delete":
      result = await executeDelete(safePath);
      break;
    case "exists":
      result = await executeExists(safePath);
      break;
    case "list":
      result = await executeList(cm, safePath, logic, context);
      break;
    case "mkdir":
      result = await executeMkdir(cm, safePath, logic, context);
      break;
    case "append":
      result = await executeAppend(cm, safePath, logic, context);
      break;
    default:
      throw new Error(`Unknown filesystem operation: "${operation}"`);
  }

  const bindTo = logic.filesystem_bind_value as string | undefined;
  if (bindTo) {
    return { stateDelta: { [extractBindKey(bindTo)]: result } };
  }
  return {};
}

/* ── Operations ───────────────────────────────────────── */

async function executeRead(
  cm: ContextManager,
  filePath: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Promise<{ content: string; size: number; path: string }> {
  const encoding = String(cm.resolveValue(logic.filesystem_encoding, context) ?? "utf-8");

  const content = await fs.readFile(filePath, { encoding: encoding as BufferEncoding });
  const stats = await fs.stat(filePath);

  return {
    content,
    size: stats.size,
    path: filePath,
  };
}

async function executeWrite(
  cm: ContextManager,
  filePath: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Promise<{ path: string; size: number }> {
  const content = String(cm.resolveValue(logic.filesystem_content, context) ?? "");
  const encoding = String(cm.resolveValue(logic.filesystem_encoding, context) ?? "utf-8");

  /* Ensure parent directory exists */
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, { encoding: encoding as BufferEncoding });

  const stats = await fs.stat(filePath);
  return { path: filePath, size: stats.size };
}

async function executeDelete(
  filePath: string,
): Promise<{ path: string; deleted: boolean }> {
  try {
    await fs.unlink(filePath);
    return { path: filePath, deleted: true };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { path: filePath, deleted: false };
    }
    throw err;
  }
}

async function executeExists(
  filePath: string,
): Promise<{ path: string; exists: boolean; isFile: boolean; isDirectory: boolean }> {
  try {
    const stats = await fs.stat(filePath);
    return {
      path: filePath,
      exists: true,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch {
    return { path: filePath, exists: false, isFile: false, isDirectory: false };
  }
}

async function executeList(
  cm: ContextManager,
  dirPath: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Promise<{ path: string; entries: { name: string; type: string; size: number }[] }> {
  const pattern = cm.resolveValue(logic.filesystem_pattern, context) as string | undefined;

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  let result = entries.map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? "directory" : "file",
    size: 0,
  }));

  /* Optional glob-like filter (simple wildcard matching) */
  if (pattern) {
    const regex = new RegExp(
      "^" + pattern.replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
    );
    result = result.filter((e) => regex.test(e.name));
  }

  /* Get sizes for files */
  for (const entry of result) {
    if (entry.type === "file") {
      try {
        const stats = await fs.stat(path.join(dirPath, entry.name));
        entry.size = stats.size;
      } catch {
        /* skip stat errors */
      }
    }
  }

  return { path: dirPath, entries: result };
}

async function executeMkdir(
  cm: ContextManager,
  dirPath: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Promise<{ path: string; created: boolean }> {
  const recursive = cm.resolveValue(logic.filesystem_recursive, context) === true;

  try {
    await fs.mkdir(dirPath, { recursive });
    return { path: dirPath, created: true };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EEXIST") {
      return { path: dirPath, created: false };
    }
    throw err;
  }
}

async function executeAppend(
  cm: ContextManager,
  filePath: string,
  logic: Record<string, unknown>,
  context: WorkflowContext,
): Promise<{ path: string; size: number }> {
  const content = String(cm.resolveValue(logic.filesystem_content, context) ?? "");
  const encoding = String(cm.resolveValue(logic.filesystem_encoding, context) ?? "utf-8");

  await fs.appendFile(filePath, content, { encoding: encoding as BufferEncoding });

  const stats = await fs.stat(filePath);
  return { path: filePath, size: stats.size };
}

/* ── Path validation ──────────────────────────────────── */

/**
 * Validate a path to prevent directory traversal attacks.
 * Rejects paths containing `..` segments.
 */
export function validatePath(inputPath: string): string {
  const normalized = path.normalize(inputPath);

  /* Block directory traversal */
  if (normalized.includes("..")) {
    throw new Error(
      `Path validation failed: "${inputPath}" contains directory traversal (".."). ` +
      "Use absolute paths or paths relative to the working directory.",
    );
  }

  return normalized;
}

/* ── Helpers ──────────────────────────────────────────── */

function extractBindKey(bindTo: string): string {
  if (bindTo.startsWith("$state.")) return bindTo.slice(7);
  return bindTo;
}

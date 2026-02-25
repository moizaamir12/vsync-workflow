import { Client as FtpClient } from "basic-ftp";
import type { Block, WorkflowContext } from "@vsync/shared-types";
import type { BlockResult } from "@vsync/engine";
import { ContextManager } from "@vsync/engine";

/**
 * FTP block executor using basic-ftp.
 *
 * Operations: upload, download, list, mkdir, delete, move
 * Supports TLS connections via ftp_secure flag.
 */
export async function nodeFtpExecutor(
  block: Block,
  context: WorkflowContext,
): Promise<BlockResult> {
  const cm = new ContextManager();
  const logic = block.logic;

  const operation = String(cm.resolveValue(logic.ftp_operation, context) ?? "");
  const host = String(cm.resolveValue(logic.ftp_host, context) ?? "");

  if (!operation) throw new Error("ftp_operation is required");
  if (!host) throw new Error("ftp_host is required");

  const port = Number(cm.resolveValue(logic.ftp_port, context) ?? 21);
  const username = cm.resolveValue(logic.ftp_username, context) as string | undefined;
  const password = cm.resolveValue(logic.ftp_password, context) as string | undefined;
  const secure = cm.resolveValue(logic.ftp_secure, context) === true;
  const remotePath = String(cm.resolveValue(logic.ftp_remote_path, context) ?? "/");
  const localPath = cm.resolveValue(logic.ftp_local_path, context) as string | undefined;
  const timeoutMs = Number(cm.resolveValue(logic.ftp_timeout_ms, context) ?? 30_000);

  const client = new FtpClient(timeoutMs);

  try {
    /* Connect with optional TLS */
    await client.access({
      host,
      port,
      user: username ?? undefined,
      password: password ?? undefined,
      secure,
    });

    let result: unknown;

    switch (operation) {
      case "upload": {
        if (!localPath) throw new Error("ftp_local_path is required for upload");
        await client.uploadFrom(localPath, remotePath);
        result = { operation: "upload", remotePath, localPath, success: true };
        break;
      }
      case "download": {
        if (!localPath) throw new Error("ftp_local_path is required for download");
        await client.downloadTo(localPath, remotePath);
        result = { operation: "download", remotePath, localPath, success: true };
        break;
      }
      case "list": {
        const entries = await client.list(remotePath);
        result = {
          operation: "list",
          remotePath,
          entries: entries.map((e) => ({
            name: e.name,
            type: e.isDirectory ? "directory" : "file",
            size: e.size,
            modifiedAt: e.rawModifiedAt,
          })),
        };
        break;
      }
      case "mkdir": {
        await client.ensureDir(remotePath);
        result = { operation: "mkdir", remotePath, success: true };
        break;
      }
      case "delete": {
        await client.remove(remotePath);
        result = { operation: "delete", remotePath, success: true };
        break;
      }
      case "move": {
        const destination = String(cm.resolveValue(logic.ftp_destination, context) ?? "");
        if (!destination) throw new Error("ftp_destination is required for move");
        await client.rename(remotePath, destination);
        result = { operation: "move", from: remotePath, to: destination, success: true };
        break;
      }
      default:
        throw new Error(`Unknown FTP operation: "${operation}"`);
    }

    const bindTo = logic.ftp_bind_value as string | undefined;
    if (bindTo) {
      return { stateDelta: { [extractBindKey(bindTo)]: result } };
    }
    return {};
  } finally {
    client.close();
  }
}

/* ── Helpers ──────────────────────────────────────────── */

function extractBindKey(bindTo: string): string {
  if (bindTo.startsWith("$state.")) return bindTo.slice(7);
  return bindTo;
}

import { ipcMain, dialog, Notification, app, safeStorage } from "electron";
import os from "node:os";
import Store from "electron-store";

/** Persistent local config (auth tokens, preferences, etc.). */
const store = new Store<{ encryptedToken?: string }>({ name: "vsync-desktop" });

/**
 * Registers all IPC channel handlers.
 *
 * Each handler maps to a whitelisted channel in the preload script.
 * The `apiPort` is passed in after the local server starts so the
 * renderer knows where to point its API client.
 */
export function registerIpcHandlers(apiPort: number): void {
  /* ── Config ────────────────────────────────────────── */

  ipcMain.handle("desktop:get-config", () => ({
    apiUrl: `http://localhost:${apiPort}`,
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
  }));

  /* ── System info ───────────────────────────────────── */

  ipcMain.handle("desktop:get-system-info", () => ({
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
    freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.versions.node,
    electronVersion: process.versions.electron,
  }));

  /* ── File dialogs ──────────────────────────────────── */

  ipcMain.handle("desktop:open-file-dialog", async (_event, options?: {
    title?: string;
    filters?: Electron.FileFilter[];
    multiSelections?: boolean;
  }) => {
    const result = await dialog.showOpenDialog({
      title: options?.title ?? "Open file",
      filters: options?.filters,
      properties: [
        "openFile",
        ...(options?.multiSelections ? ["multiSelections" as const] : []),
      ],
    });
    return result.filePaths;
  });

  ipcMain.handle("desktop:save-file-dialog", async (_event, options?: {
    title?: string;
    defaultPath?: string;
    filters?: Electron.FileFilter[];
  }) => {
    const result = await dialog.showSaveDialog({
      title: options?.title ?? "Save file",
      defaultPath: options?.defaultPath,
      filters: options?.filters,
    });
    return result.filePath ?? null;
  });

  /* ── Auth token (encrypted via safeStorage) ─────────── */

  // TODO(auth): Validate the decrypted token is a valid JWT (not expired, proper structure) before returning it.
  ipcMain.handle("desktop:get-auth-token", () => {
    const encrypted = store.get("encryptedToken");
    if (!encrypted) return null;

    if (!safeStorage.isEncryptionAvailable()) {
      /* Fallback: stored as plain base64 on systems without keychain */
      return Buffer.from(encrypted, "base64").toString("utf8");
    }

    return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
  });

  ipcMain.handle("desktop:set-auth-token", (_event, token: string) => {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token);
      store.set("encryptedToken", encrypted.toString("base64"));
    } else {
      /* Fallback: store as plain base64 */
      store.set("encryptedToken", Buffer.from(token, "utf8").toString("base64"));
    }
  });

  ipcMain.handle("desktop:clear-auth-token", () => {
    store.delete("encryptedToken");
  });

  /* ── Notifications ─────────────────────────────────── */

  ipcMain.handle("desktop:show-notification", (_event, title: string, body: string) => {
    new Notification({ title, body }).show();
  });

  /* ── App paths ─────────────────────────────────────── */

  ipcMain.handle("desktop:get-app-path", (_event, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0]);
  });
}

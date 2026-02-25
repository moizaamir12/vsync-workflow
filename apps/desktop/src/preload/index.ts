import { contextBridge, ipcRenderer } from "electron";

/**
 * Preload script — exposes a strict, whitelisted set of IPC channels
 * to the renderer via `window.electronAPI`.
 *
 * Each method maps to exactly one `ipcRenderer.invoke()` call.
 * No raw `ipcRenderer` access is leaked to the renderer.
 */
contextBridge.exposeInMainWorld("electronAPI", {
  getConfig: () => ipcRenderer.invoke("desktop:get-config"),

  getSystemInfo: () => ipcRenderer.invoke("desktop:get-system-info"),

  openFileDialog: (options?: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    multiSelections?: boolean;
  }) => ipcRenderer.invoke("desktop:open-file-dialog", options),

  saveFileDialog: (options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => ipcRenderer.invoke("desktop:save-file-dialog", options),

  getAuthToken: () => ipcRenderer.invoke("desktop:get-auth-token"),

  setAuthToken: (token: string) =>
    ipcRenderer.invoke("desktop:set-auth-token", token),

  clearAuthToken: () => ipcRenderer.invoke("desktop:clear-auth-token"),

  showNotification: (title: string, body: string) =>
    ipcRenderer.invoke("desktop:show-notification", title, body),

  getAppPath: (name: string) =>
    ipcRenderer.invoke("desktop:get-app-path", name),
});

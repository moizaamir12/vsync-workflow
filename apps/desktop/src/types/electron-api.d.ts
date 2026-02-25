/** Shape of the API exposed to renderer via contextBridge. */
export interface ElectronAPI {
  /** Retrieve desktop-specific config (API port, version, platform). */
  getConfig(): Promise<{
    apiUrl: string;
    appVersion: string;
    platform: NodeJS.Platform;
    arch: string;
  }>;

  /** Retrieve system information (hostname, cpus, memory, etc.). */
  getSystemInfo(): Promise<{
    hostname: string;
    cpus: number;
    totalMemoryMb: number;
    freeMemoryMb: number;
    platform: NodeJS.Platform;
    arch: string;
    nodeVersion: string;
    electronVersion: string;
  }>;

  /** Open a native file picker and return selected paths. */
  openFileDialog(options?: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    multiSelections?: boolean;
  }): Promise<string[]>;

  /** Open a native save dialog and return the chosen path. */
  saveFileDialog(options?: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }): Promise<string | null>;

  /** Read the encrypted auth token from local storage. */
  getAuthToken(): Promise<string | null>;

  /** Persist an encrypted auth token locally. */
  setAuthToken(token: string): Promise<void>;

  /** Remove the stored auth token. */
  clearAuthToken(): Promise<void>;

  /** Show a native OS notification. */
  showNotification(title: string, body: string): Promise<void>;

  /** Resolve an Electron app path by name. */
  getAppPath(name: string): Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

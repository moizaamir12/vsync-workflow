import fs from "node:fs";
import os from "node:os";

/** Callback signature for file-system change events. */
export type FsWatchCallback = (eventType: string, filename: string | null) => void;

/**
 * Creates a recursive file-system watcher.
 * Returns a cleanup function to close the watcher.
 */
export function createFsWatcher(
  dir: string,
  callback: FsWatchCallback,
): () => void {
  const watcher = fs.watch(dir, { recursive: true }, (event, filename) => {
    callback(event, filename);
  });

  return () => watcher.close();
}

/** Get all active network interfaces with their addresses. */
export function getNetworkInterfaces(): Array<{
  name: string;
  address: string;
  family: string;
  internal: boolean;
}> {
  const interfaces = os.networkInterfaces();
  const result: Array<{
    name: string;
    address: string;
    family: string;
    internal: boolean;
  }> = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      result.push({
        name,
        address: addr.address,
        family: addr.family,
        internal: addr.internal,
      });
    }
  }

  return result;
}

/**
 * Discover locally attached cameras.
 * Stub — real implementation would use platform-specific APIs.
 */
export function discoverCameras(): Array<{ id: string; name: string }> {
  return [];
}

/**
 * Local ML model runner facade.
 * Stub — will integrate with ONNX Runtime or llama.cpp in the future.
 */
export function createLocalModelRunner(): {
  isAvailable: () => boolean;
  run: (input: string) => Promise<string>;
} {
  return {
    isAvailable: () => false,
    run: async () => {
      throw new Error("Local model runner is not yet available");
    },
  };
}

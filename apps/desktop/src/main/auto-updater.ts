import { autoUpdater } from "electron-updater";
import log from "electron-log";

/** How often (ms) to check for updates after the initial check. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Initialises automatic update checking via electron-updater.
 *
 * Checks immediately on launch, then every 4 hours.
 * All lifecycle events are logged via electron-log so they appear
 * in the OS log viewer and the app's log files.
 */
export function initAutoUpdater(): void {
  autoUpdater.logger = log;

  autoUpdater.on("checking-for-update", () => {
    log.info("[auto-updater] Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    log.info(`[auto-updater] Update available: ${info.version}`);
  });

  autoUpdater.on("update-not-available", () => {
    log.info("[auto-updater] No update available.");
  });

  autoUpdater.on("download-progress", (progress) => {
    log.info(`[auto-updater] Download progress: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on("update-downloaded", (info) => {
    log.info(`[auto-updater] Update downloaded: ${info.version}. Will install on quit.`);
  });

  autoUpdater.on("error", (err) => {
    log.error("[auto-updater] Error:", err);
  });

  /* Initial check */
  void autoUpdater.checkForUpdatesAndNotify();

  /* Periodic checks */
  setInterval(() => {
    void autoUpdater.checkForUpdatesAndNotify();
  }, CHECK_INTERVAL_MS);
}

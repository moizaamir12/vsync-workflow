import path from "node:path";
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import log from "electron-log";
import crypto from "node:crypto";
import Store from "electron-store";

import { createDesktopDatabase } from "./db-bootstrap.js";
import { startLocalServer } from "./local-server.js";
import { registerIpcHandlers } from "./ipc-handlers.js";
import { initAutoUpdater } from "./auto-updater.js";
import { SyncService } from "./sync-service.js";

/* ── Logging ──────────────────────────────────────────────── */

log.initialize();
log.info(`[desktop] V Sync Desktop v${app.getVersion()} starting...`);

/* ── Persistent store (preferences, secrets, auth) ────────── */

const store = new Store<{
  authSecret?: string;
  cloudUrl?: string;
  authToken?: string;
}>({ name: "vsync-config" });

/* ── AUTH_SECRET — generate once and persist locally ──────── */

function ensureAuthSecret(): string {
  let secret = store.get("authSecret");
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex");
    store.set("authSecret", secret);
    log.info("[desktop] Generated new AUTH_SECRET.");
  }
  process.env["AUTH_SECRET"] = secret;
  return secret;
}

/* ── Global references (prevent GC) ──────────────────────── */

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverShutdown: (() => void) | null = null;
let syncService: SyncService | null = null;

/* ── Main ─────────────────────────────────────────────────── */

async function bootstrap(): Promise<void> {
  /* 1. Auth secret */
  ensureAuthSecret();

  /* 2. Database */
  const dataDir = path.join(app.getPath("userData"), "vsync-data");
  log.info(`[desktop] Data directory: ${dataDir}`);
  const db = createDesktopDatabase(dataDir);

  /* 3. Local API server */
  const { port, shutdown } = await startLocalServer(db);
  serverShutdown = shutdown;
  log.info(`[desktop] Local API on port ${port}`);

  /* 4. IPC handlers */
  registerIpcHandlers(port);

  /* 5. Main window */
  mainWindow = createMainWindow(port);

  /* 6. System tray */
  tray = createTray();

  /* 7. Auto-updater (skip in dev) */
  if (app.isPackaged) {
    initAutoUpdater();
  }

  /* 8. Sync service */
  syncService = new SyncService(db);
  const cloudUrl = store.get("cloudUrl");
  const authToken = store.get("authToken");
  if (cloudUrl && authToken) {
    syncService.setConfig({ cloudUrl, authToken });
    syncService.start();
  }
}

/* ── Window ───────────────────────────────────────────────── */

function createMainWindow(apiPort: number): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "V Sync",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "index.cjs"),
      /* Preload must remain CJS for Electron sandbox compatibility */
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  /* Dev → load Next.js dev server;  Prod → load built assets */
  const devUrl = process.env["VITE_DEV_SERVER_URL"] ?? `http://localhost:3000`;

  if (!app.isPackaged) {
    void win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    /* In production the renderer is served by the local API */
    void win.loadURL(`http://localhost:${apiPort}`);
  }

  win.on("closed", () => {
    mainWindow = null;
  });

  return win;
}

/* ── Tray ─────────────────────────────────────────────────── */

function createTray(): Tray {
  /* Use a 16x16 empty image as placeholder — real icon in resources/ */
  const icon = nativeImage.createEmpty();
  const t = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show / Hide",
      click: () => {
        if (mainWindow?.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow?.show();
          mainWindow?.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit V Sync",
      click: () => {
        app.quit();
      },
    },
  ]);

  t.setToolTip("V Sync Desktop");
  t.setContextMenu(contextMenu);
  return t;
}

/* ── Lifecycle ────────────────────────────────────────────── */

app.whenReady().then(() => {
  void bootstrap();

  app.on("activate", () => {
    /* macOS: re-create window when dock icon is clicked and no windows open */
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow(0);
    }
  });
});

app.on("window-all-closed", () => {
  /* On macOS it's common to stay open until Cmd+Q */
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  log.info("[desktop] Shutting down...");
  syncService?.stop();
  serverShutdown?.();
  log.info("[desktop] Goodbye.");
});

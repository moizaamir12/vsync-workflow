/** @type {import("electron-builder").Configuration} */
const config = {
  appId: "io.vsync.desktop",
  productName: "V Sync",
  directories: {
    output: "release",
    buildResources: "resources",
  },
  files: [
    "dist/**/*",
    "package.json",
  ],
  /* Native module rebuild — better-sqlite3 needs to match Electron's Node ABI */
  nodeGypRebuild: false,
  npmRebuild: true,

  /* ── macOS ──────────────────────────────────────────────── */
  mac: {
    target: [
      { target: "dmg", arch: ["x64", "arm64"] },
      { target: "zip", arch: ["x64", "arm64"] },
    ],
    category: "public.app-category.developer-tools",
    hardenedRuntime: true,
    gatekeeperAssess: false,
  },

  /* ── Windows ────────────────────────────────────────────── */
  win: {
    target: [{ target: "nsis", arch: ["x64"] }],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },

  /* ── Linux ──────────────────────────────────────────────── */
  linux: {
    target: [
      { target: "AppImage", arch: ["x64"] },
      { target: "deb", arch: ["x64"] },
    ],
    category: "Development",
  },

  /* ── Auto-update via GitHub Releases ────────────────────── */
  publish: {
    provider: "github",
    owner: "vsync",
    repo: "vsync-workflow",
  },
};

export default config;

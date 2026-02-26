import { defineConfig } from "tsup";

export default defineConfig([
  /* ── Main process ──────────────────────────────────────── */
  {
    entry: ["src/main/index.ts"],
    outDir: "dist/main",
    format: ["cjs"],
    platform: "node",
    target: "node20",
    sourcemap: true,
    clean: true,
    /* Bundle workspace packages AND ESM-only deps into the
       CJS output so Electron's require() can load them.
       Native modules stay external because they must be
       resolved at runtime by Electron. */
    noExternal: [/^@vsync\//, "electron-store", "electron-log"],
    external: [
      "electron",
      "better-sqlite3",
      "esbuild",
      "sharp",
    ],
  },

  /* ── Preload script (CJS required by Electron) ────────── */
  {
    entry: ["src/preload/index.ts"],
    outDir: "dist/preload",
    format: ["cjs"],
    platform: "node",
    target: "node20",
    sourcemap: true,
    clean: true,
    external: ["electron"],
  },
]);

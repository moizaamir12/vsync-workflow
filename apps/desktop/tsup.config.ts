import { defineConfig } from "tsup";

export default defineConfig([
  /* ── Main process ──────────────────────────────────────── */
  {
    entry: ["src/main/index.ts"],
    outDir: "dist/main",
    format: ["esm"],
    platform: "node",
    target: "node20",
    sourcemap: true,
    clean: true,
    /* Bundle workspace packages into the output so Electron only
       needs a single entry point.  Native modules stay external
       because they must be resolved at runtime by Electron. */
    noExternal: [/^@vsync\//],
    external: [
      "electron",
      "better-sqlite3",
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

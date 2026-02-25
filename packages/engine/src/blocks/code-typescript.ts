import { transform } from "esbuild";

/**
 * Transpile TypeScript to JavaScript using esbuild's transform API.
 *
 * Strips types only — no bundling, no tree-shaking.
 * This is a fast, lightweight alternative to running the full tsc compiler.
 * Returns plain JavaScript ready for vm.Script compilation.
 */
export async function transpileTypeScript(source: string): Promise<string> {
  const result = await transform(source, {
    loader: "ts",
    /* Target ES2022 to match the project's tsconfig */
    target: "es2022",
    /* Don't generate source maps — we handle error location separately */
    sourcemap: false,
    /* Strip types without full validation — faster */
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        /* Loose transpilation — just strip types */
        strict: false,
        /* Preserve modern syntax */
        target: "ES2022",
        module: "ES2022",
      },
    }),
  });

  return result.code;
}

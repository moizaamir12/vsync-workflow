import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  /* Point Next.js at the monorepo root so it doesn't get confused
     by a stray package-lock.json in a parent directory. */
  outputFileTracingRoot: resolve(__dirname, "../../"),
  transpilePackages: ["@vsync/ui", "@vsync/shared-types"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  webpack: (config) => {
    /* Allow .js imports to resolve to .ts/.tsx source in transpiled packages */
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts", ".tsx"],
      ".jsx": [".jsx", ".tsx"],
    };
    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

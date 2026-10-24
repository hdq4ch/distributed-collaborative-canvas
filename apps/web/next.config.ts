import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Turbopack CSS config
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Cache Components выключены: OpenNext пока поддерживает их на Cloudflare не полностью
  // (https://github.com/opennextjs/opennextjs-cloudflare/pull/1318). Включить, когда PR смержат.
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

// Даёт `next dev` доступ к биндингам Cloudflare (R2 и т.д.) из wrangler.jsonc.
initOpenNextCloudflareForDev();

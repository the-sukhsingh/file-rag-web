import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["https://file-rag-web.localhost/"],
  serverExternalPackages: [
    "just-bash",
    "@mongodb-js/zstd",
    "node-liblzma",
    "seek-bzip",
    "sql.js",
    "run",
    "guarded-fetch",
  ],
};

export default nextConfig;

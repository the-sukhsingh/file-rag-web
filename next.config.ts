import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ["https://file-rag-web.localhost/"]
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Use the compiler API directly. The detached TypeScript CLI can lose its
  // captured stdout under some container runtimes, breaking `next build` even
  // though type checking succeeds.
  experimental: { useTypeScriptCli: false },
  serverExternalPackages: [
    "better-sqlite3",
    "fluent-ffmpeg",
    "ffmpeg-static",
    "ioredis",
  ],
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "better-sqlite3",
    "fluent-ffmpeg",
    "ffmpeg-static",
    "ioredis",
  ],
};

export default nextConfig;

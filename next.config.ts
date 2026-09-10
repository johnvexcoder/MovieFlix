import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Use the detached TypeScript CLI. The in-process SWC checker (fork-ts-checker)
  // uses next-code-frame for error highlighting, which has a musl-specific bug
  // with multi-byte UTF-8 characters (emojis, em-dashes, etc.) causing a Rust
  // panic: "end byte index ... is not a char boundary". The CLI path uses pure
  // TypeScript and avoids this. Stdout capture issues noted in the old comment
  // were specific to an earlier container setup and do not reproduce here.
  experimental: { useTypeScriptCli: true },
  serverExternalPackages: [
    "better-sqlite3",
    "fluent-ffmpeg",
    "ffmpeg-static",
    "ioredis",
  ],
};

export default nextConfig;

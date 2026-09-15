import crypto from "crypto";
import fs from "fs";
import path from "path";

function streamingRoot(): string {
  const configured = process.env.STREAMING_OUTPUT_DIR || "./data/streaming";
  return path.resolve(configured);
}

function safeId(value: string): string {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new Error("Invalid media identifier");
  return value;
}

export function packageDirectory(mediaId: string, episodeId: string | null, version: number): string {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error("Invalid package version");
  const itemId = episodeId ? `${safeId(mediaId)}_episode_${safeId(episodeId)}` : safeId(mediaId);
  return path.join(streamingRoot(), itemId, `package-v${version}`);
}

export function sourceFingerprint(filePath: string): string {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error("Source is not a file");
  return crypto.createHash("sha256")
    .update(path.resolve(filePath)).update("\0")
    .update(String(stat.size)).update("\0")
    .update(String(stat.mtimeMs)).digest("hex");
}

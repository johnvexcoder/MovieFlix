import fs from "node:fs";
import path from "node:path";
import type { Rendition } from "./planner";

function requiredFile(file: string): number {
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size === 0) throw new Error("PACKAGE_INVALID");
  return stat.size;
}

/** Validates a completed private package before atomic activation. */
export function validatePackage(dir: string, renditions: Rendition[], sourceDuration: number): number {
  if (renditions.length === 0) throw new Error("PACKAGE_INVALID");
  let size = requiredFile(path.join(dir, "master.m3u8"));
  const master = fs.readFileSync(path.join(dir, "master.m3u8"), "utf8");
  for (const rendition of renditions) {
    const relative = `${rendition.height}p/index.m3u8`;
    if (!master.includes(relative)) throw new Error("PACKAGE_INVALID");
    const variantDir = path.join(dir, `${rendition.height}p`);
    const playlistFile = path.join(variantDir, "index.m3u8");
    size += requiredFile(playlistFile);
    size += requiredFile(path.join(variantDir, "init.mp4"));
    const playlist = fs.readFileSync(playlistFile, "utf8");
    if (!playlist.includes("#EXT-X-ENDLIST")) throw new Error("PACKAGE_INVALID");
    const segments = [...playlist.matchAll(/^seg-\d{6}\.m4s$/gm)].map((match) => match[0]);
    if (segments.length === 0) throw new Error("PACKAGE_INVALID");
    let duration = 0;
    for (const match of playlist.matchAll(/^#EXTINF:([\d.]+)/gm)) duration += Number(match[1]);
    if (!Number.isFinite(duration) || Math.abs(duration - sourceDuration) > Math.max(12, sourceDuration * 0.05)) {
      throw new Error("PACKAGE_DURATION_MISMATCH");
    }
    for (const segment of segments) size += requiredFile(path.join(variantDir, segment));
  }
  return size;
}

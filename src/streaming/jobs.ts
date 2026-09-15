import crypto from "node:crypto";
import fs from "node:fs";
import { and, eq, isNull } from "drizzle-orm";
import { db, setupDatabase } from "@/db";
import { media, episodes, mediaStreamPackages, mediaStreamJobs } from "@/db/schema";
import { packageDirectory, sourceFingerprint } from "./storage";

export async function enqueuePreparation(mediaId: string, episodeId: string | null = null): Promise<string> {
  setupDatabase();
  const [item] = await db.select().from(media).where(eq(media.id, mediaId)).limit(1);
  if (!item) throw new Error("MEDIA_MISSING");
  let sourceFile = item.filePath;
  if (episodeId) {
    const [episode] = await db.select().from(episodes)
      .where(and(eq(episodes.id, episodeId), eq(episodes.mediaId, mediaId))).limit(1);
    if (!episode) throw new Error("MEDIA_MISSING");
    sourceFile = episode.filePath;
  }
  if (!fs.existsSync(sourceFile)) throw new Error("MEDIA_MISSING");
  const fingerprint = sourceFingerprint(sourceFile);
  const existing = await db.select().from(mediaStreamPackages)
    .where(and(eq(mediaStreamPackages.mediaId, mediaId),
      episodeId ? eq(mediaStreamPackages.episodeId, episodeId) : isNull(mediaStreamPackages.episodeId)))
    .orderBy(mediaStreamPackages.version);
  const current = existing.find((pkg) => pkg.sourceFingerprint === fingerprint &&
    ["READY", "QUEUED", "PROBING", "ENCODING", "VALIDATING"].includes(pkg.status));
  if (current) return current.id;
  const version = existing.reduce((max, pkg) => Math.max(max, pkg.version), 0) + 1;
  const now = new Date().toISOString();
  const packageId = crypto.randomUUID();
  await db.insert(mediaStreamPackages).values({ id: packageId, mediaId, episodeId, version,
    status: "QUEUED", sourceFingerprint: fingerprint, createdAt: now, updatedAt: now });
  await db.insert(mediaStreamJobs).values({ id: crypto.randomUUID(), packageId,
    status: "QUEUED", stage: "QUEUED", createdAt: now, updatedAt: now });
  return packageId;
}

export async function findReadyPackage(mediaId: string, episodeId: string | null) {
  setupDatabase();
  const packages = await db.select().from(mediaStreamPackages)
    .where(and(eq(mediaStreamPackages.mediaId, mediaId),
      episodeId ? eq(mediaStreamPackages.episodeId, episodeId) : isNull(mediaStreamPackages.episodeId),
      eq(mediaStreamPackages.status, "READY")))
    .orderBy(mediaStreamPackages.version);
  for (const pkg of packages.reverse()) {
    const dir = packageDirectory(mediaId, episodeId, pkg.version);
    if (fs.existsSync(dir)) return { package: pkg, dir };
  }
  return null;
}

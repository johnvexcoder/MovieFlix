import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db, setupDatabase } from "@/db";
import { episodes, media, mediaStreamJobs, mediaStreamPackages } from "@/db/schema";
import { encodePackage } from "./encoder";
import { packageDirectory, sourceFingerprint } from "./storage";
import { validatePackage } from "./validator";

function lowDisk(dir: string): boolean {
  fs.mkdirSync(dir, { recursive: true });
  const stat = fs.statfsSync(dir);
  const freeGb = Number(stat.bavail) * Number(stat.bsize) / 1024 ** 3;
  return freeGb < Number(process.env.STREAMING_MIN_FREE_DISK_GB || 20);
}

export async function prepareNextJob(signal?: AbortSignal): Promise<boolean> {
  setupDatabase();
  const [job] = await db.select().from(mediaStreamJobs)
    .where(eq(mediaStreamJobs.status, "QUEUED")).limit(1);
  if (!job) return false;
  const [pkg] = await db.select().from(mediaStreamPackages)
    .where(eq(mediaStreamPackages.id, job.packageId)).limit(1);
  if (!pkg) return false;
  const [item] = await db.select().from(media).where(eq(media.id, pkg.mediaId)).limit(1);
  if (!item) throw new Error("MEDIA_MISSING");
  let sourceFile = item.filePath;
  if (pkg.episodeId) {
    const [episode] = await db.select().from(episodes)
      .where(and(eq(episodes.id, pkg.episodeId), eq(episodes.mediaId, pkg.mediaId))).limit(1);
    if (!episode) throw new Error("MEDIA_MISSING");
    sourceFile = episode.filePath;
  }
  const target = packageDirectory(pkg.mediaId, pkg.episodeId, pkg.version);
  const parent = path.dirname(target);
  const now = new Date().toISOString();
  const claimed = await db.update(mediaStreamJobs).set({ status: "PROBING", stage: "PROBING",
    attempts: job.attempts + 1, updatedAt: now,
    leaseExpiresAt: new Date(Date.now() + 180_000).toISOString() })
    .where(and(eq(mediaStreamJobs.id, job.id), eq(mediaStreamJobs.status, "QUEUED"))).returning();
  if (!claimed.length) return true;
  const temp = path.join(parent, `.package-v${pkg.version}.tmp-${crypto.randomUUID()}`);
  const jobController = new AbortController();
  if (signal) signal.addEventListener("abort", () => jobController.abort(), { once: true });
  const heartbeat = setInterval(() => {
    void (async () => {
      const [latest] = await db.select({ status: mediaStreamJobs.status }).from(mediaStreamJobs)
        .where(eq(mediaStreamJobs.id, job.id)).limit(1);
      if (!latest || latest.status === "CANCELLED") { jobController.abort(); return; }
      await db.update(mediaStreamJobs).set({ updatedAt: new Date().toISOString(),
        leaseExpiresAt: new Date(Date.now() + 180_000).toISOString() })
        .where(eq(mediaStreamJobs.id, job.id));
    })().catch(() => jobController.abort());
  }, 30_000);
  try {
    if (!fs.existsSync(sourceFile) || sourceFingerprint(sourceFile) !== pkg.sourceFingerprint) {
      throw new Error("SOURCE_CHANGED");
    }
    if (lowDisk(parent)) throw new Error("BLOCKED_LOW_DISK");
    await db.update(mediaStreamJobs).set({ status: "ENCODING", stage: "ENCODING" })
      .where(eq(mediaStreamJobs.id, job.id));
    await db.update(mediaStreamPackages).set({ status: "ENCODING", updatedAt: now })
      .where(eq(mediaStreamPackages.id, pkg.id));
    const result = await encodePackage(sourceFile, temp,
      Number(process.env.STREAMING_SEGMENT_SECONDS || 4),
      (completed, total) => {
        if (lowDisk(parent)) throw new Error("BLOCKED_LOW_DISK");
        void db.update(mediaStreamJobs).set({ progress: Math.floor(completed / total * 90) })
          .where(eq(mediaStreamJobs.id, job.id));
      }, jobController.signal);
    await db.update(mediaStreamJobs).set({ status: "VALIDATING", stage: "VALIDATING", progress: 95 })
      .where(eq(mediaStreamJobs.id, job.id));
    const size = validatePackage(temp, result.renditions, result.source.durationSeconds);
    if (fs.existsSync(target)) throw new Error("PACKAGE_VERSION_EXISTS");
    fs.renameSync(temp, target);
    const done = new Date().toISOString();
    await db.update(mediaStreamPackages).set({ status: "READY", sizeBytes: size,
      renditionsJson: JSON.stringify(result.renditions), preparedAt: done, updatedAt: done })
      .where(eq(mediaStreamPackages.id, pkg.id));
    await db.update(mediaStreamJobs).set({ status: "READY", stage: "READY", progress: 100, updatedAt: done })
      .where(eq(mediaStreamJobs.id, job.id));
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    const code = error instanceof Error ? error.message.slice(0, 80) : "PREPARATION_FAILED";
    const [latest] = await db.select({ status: mediaStreamJobs.status }).from(mediaStreamJobs)
      .where(eq(mediaStreamJobs.id, job.id)).limit(1);
    const cancelled = latest?.status === "CANCELLED";
    await db.update(mediaStreamPackages).set({ status: cancelled ? "UNPREPARED" : "FAILED", errorCode: code })
      .where(eq(mediaStreamPackages.id, pkg.id));
    await db.update(mediaStreamJobs).set({ status: cancelled ? "CANCELLED" : "FAILED",
      stage: cancelled ? "CANCELLED" : "FAILED", errorCode: code })
      .where(eq(mediaStreamJobs.id, job.id));
  } finally {
    clearInterval(heartbeat);
  }
  return true;
}

/** Release interrupted leases after a worker/container restart. */
export async function recoverStaleJobs(): Promise<void> {
  setupDatabase();
  const stale = await db.select().from(mediaStreamJobs)
    .where(and(inArray(mediaStreamJobs.status, ["PROBING", "ENCODING", "VALIDATING"]),
      lt(mediaStreamJobs.leaseExpiresAt, new Date().toISOString())));
  for (const job of stale) {
    const status = job.attempts < 3 ? "QUEUED" : "FAILED";
    await db.update(mediaStreamJobs).set({ status, stage: status,
      leaseExpiresAt: null, updatedAt: new Date().toISOString() })
      .where(eq(mediaStreamJobs.id, job.id));
    await db.update(mediaStreamPackages).set({ status, updatedAt: new Date().toISOString() })
      .where(eq(mediaStreamPackages.id, job.packageId));
  }
}

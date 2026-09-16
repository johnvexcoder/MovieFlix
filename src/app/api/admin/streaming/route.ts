import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, setupDatabase } from "@/db";
import { episodes, media, mediaStreamJobs, mediaStreamPackages } from "@/db/schema";
import { verifyToken } from "@/lib/auth";
import { enqueuePreparation } from "@/streaming/jobs";

async function authorized(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("admin_token")?.value;
  const payload = token ? await verifyToken(token) : null;
  return Boolean(payload?.isAdmin);
}

export async function GET(request: NextRequest) {
  if (!await authorized(request)) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  setupDatabase();
  const packages = await db.select().from(mediaStreamPackages)
    .orderBy(desc(mediaStreamPackages.createdAt)).limit(200);
  const jobs = await db.select().from(mediaStreamJobs)
    .orderBy(desc(mediaStreamJobs.createdAt)).limit(200);
  // Lightweight catalog options so the preparation form can use selectors
  // instead of requiring admins to paste raw media/episode IDs.
  const mediaOptions = await db
    .select({ id: media.id, title: media.title, type: media.type })
    .from(media)
    .orderBy(media.title)
    .limit(1000);
  const episodeOptions = await db
    .select({
      id: episodes.id,
      mediaId: episodes.mediaId,
      episodeNumber: episodes.episodeNumber,
      title: episodes.title,
    })
    .from(episodes)
    .orderBy(episodes.mediaId, episodes.episodeNumber)
    .limit(5000);
  return NextResponse.json({ packages, jobs, media: mediaOptions, episodes: episodeOptions });
}

export async function POST(request: NextRequest) {
  if (!await authorized(request)) return NextResponse.json({ error: "Admin required" }, { status: 403 });
  const body = await request.json().catch(() => null) as
    { action?: unknown; mediaId?: unknown; episodeId?: unknown; jobId?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (body.action === "queue" || body.action === "retry") {
    const mediaId = typeof body.mediaId === "string" ? body.mediaId : "";
    const episodeId = typeof body.episodeId === "string" ? body.episodeId : null;
    if (!mediaId) return NextResponse.json({ error: "Media ID required" }, { status: 400 });
    try { return NextResponse.json({ packageId: await enqueuePreparation(mediaId, episodeId) }); }
    catch { return NextResponse.json({ error: "Could not queue media" }, { status: 400 }); }
  }
  if (body.action === "cancel" && typeof body.jobId === "string") {
    setupDatabase();
    const [job] = await db.select().from(mediaStreamJobs)
      .where(eq(mediaStreamJobs.id, body.jobId)).limit(1);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (["READY", "FAILED", "CANCELLED"].includes(job.status))
      return NextResponse.json({ error: "Job is already finished" }, { status: 409 });
    await db.update(mediaStreamJobs).set({ status: "CANCELLED", stage: "CANCELLED",
      updatedAt: new Date().toISOString() }).where(eq(mediaStreamJobs.id, job.id));
    await db.update(mediaStreamPackages).set({ status: "UNPREPARED",
      updatedAt: new Date().toISOString() }).where(eq(mediaStreamPackages.id, job.packageId));
    return NextResponse.json({ cancelled: true });
  }
  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}

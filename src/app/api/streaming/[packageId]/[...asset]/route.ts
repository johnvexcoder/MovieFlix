import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, setupDatabase } from "@/db";
import { accounts, mediaStreamPackages, playbackSessions, subscriptions } from "@/db/schema";
import { packageDirectory } from "@/streaming/storage";

export const dynamic = "force-dynamic";

function allowedAsset(parts: string[]): boolean {
  if (parts.length === 1) return parts[0] === "master.m3u8";
  if (parts.length !== 2 || !/^\d{2,4}p$/.test(parts[0])) return false;
  return parts[1] === "index.m3u8" || parts[1] === "init.mp4" || /^seg-\d{6}\.m4s$/.test(parts[1]);
}

export async function GET(request: NextRequest,
  { params }: { params: Promise<{ packageId: string; asset: string[] }> }) {
  if (process.env.STREAMING_V2_ENABLED !== "true")
    return new NextResponse("Unavailable", { status: 503 });
  setupDatabase();
  const { packageId, asset } = await params;
  if (!allowedAsset(asset)) return new NextResponse("Not found", { status: 404 });
  const sessionId = request.cookies.get("mvf_playback")?.value;
  if (!sessionId) return new NextResponse("Unauthorized", { status: 401 });
  const [session] = await db.select().from(playbackSessions)
    .where(and(eq(playbackSessions.id, sessionId), eq(playbackSessions.packageId, packageId))).limit(1);
  if (!session || session.revokedAt || Date.parse(session.expiresAt) <= Date.now())
    return new NextResponse("Session expired", { status: 401 });
  const [account] = await db.select().from(accounts).where(eq(accounts.id, session.accountId)).limit(1);
  if (!account || account.isLocked || account.registrationStatus !== "active" ||
      (account.expiresAt && Date.parse(account.expiresAt) <= Date.now()))
    return new NextResponse("Account unavailable", { status: 403 });
  const [subscription] = await db.select().from(subscriptions)
    .where(eq(subscriptions.accountId, session.accountId)).limit(1);
  if (subscription && (subscription.status !== "ACTIVE" ||
      (!subscription.isLifetime && subscription.currentPeriodEnd && Date.parse(subscription.currentPeriodEnd) <= Date.now())))
    return new NextResponse("Subscription required", { status: 403 });
  const [pkg] = await db.select().from(mediaStreamPackages)
    .where(and(eq(mediaStreamPackages.id, packageId), eq(mediaStreamPackages.status, "READY"))).limit(1);
  if (!pkg || pkg.mediaId !== session.mediaId) return new NextResponse("Not found", { status: 404 });
  const dir = packageDirectory(pkg.mediaId, pkg.episodeId, pkg.version);
  const file = path.join(dir, ...asset);
  if (!fs.existsSync(file)) return new NextResponse("Not found", { status: 404 });
  const stat = fs.statSync(file);
  if (!stat.isFile()) return new NextResponse("Not found", { status: 404 });
  const contentType = file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" :
    file.endsWith(".mp4") ? "video/mp4" : "video/iso.segment";
  const fileStream = fs.createReadStream(file);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      fileStream.on("data", (chunk) => controller.enqueue(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (error) => controller.error(error));
    },
    cancel() { fileStream.destroy(); },
  });
  return new NextResponse(stream, { headers: {
    "Content-Type": contentType, "Content-Length": String(stat.size),
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}

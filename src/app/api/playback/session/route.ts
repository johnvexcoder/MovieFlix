import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, setupDatabase } from "@/db";
import { accounts, episodes, media, playbackSessions, profiles, subscriptions } from "@/db/schema";
import { verifyToken } from "@/lib/auth";
import { findReadyPackage } from "@/streaming/jobs";

export async function POST(request: NextRequest) {
  setupDatabase();
  const token = request.cookies.get("access_token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as { mediaId?: unknown; episodeId?: unknown; profileId?: unknown; quality?: unknown } | null;
  const mediaId = typeof body?.mediaId === "string" ? body.mediaId : "";
  const episodeId = typeof body?.episodeId === "string" ? body.episodeId : null;
  if (!mediaId || (body?.profileId && body.profileId !== payload.profileId))
    return NextResponse.json({ error: "Invalid playback scope" }, { status: 400 });
  const [profile] = await db.select().from(profiles)
    .where(and(eq(profiles.id, payload.profileId), eq(profiles.accountId, payload.accountId))).limit(1);
  const [account] = await db.select().from(accounts).where(eq(accounts.id, payload.accountId)).limit(1);
  if (!profile || !account || account.isLocked || account.registrationStatus !== "active" ||
      (account.expiresAt && Date.parse(account.expiresAt) <= Date.now()))
    return NextResponse.json({ error: "Account unavailable" }, { status: 403 });
  const [subscription] = await db.select().from(subscriptions)
    .where(eq(subscriptions.accountId, account.id)).limit(1);
  if (subscription && (subscription.status !== "ACTIVE" ||
      (!subscription.isLifetime && subscription.currentPeriodEnd && Date.parse(subscription.currentPeriodEnd) <= Date.now())))
    return NextResponse.json({ error: "Subscription required" }, { status: 403 });
  const [item] = await db.select({ id: media.id }).from(media).where(eq(media.id, mediaId)).limit(1);
  if (!item) return NextResponse.json({ error: "Media missing" }, { status: 404 });
  if (episodeId) {
    const [episode] = await db.select({ id: episodes.id }).from(episodes)
      .where(and(eq(episodes.id, episodeId), eq(episodes.mediaId, mediaId))).limit(1);
    if (!episode) return NextResponse.json({ error: "Episode missing" }, { status: 404 });
  }
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const quality = typeof body?.quality === "string" ? body.quality : null;

  // Try to use a prepared V2 package when available; otherwise this is a
  // direct (range-stream) session. In BOTH cases we record a playback session
  // so "Streaming Now" / account ACTIVE-OFFLINE reflect real playback, not
  // only V2-enabled titles.
  const ready = await findReadyPackage(mediaId, episodeId);
  let mode: "hls" | "direct" = "hls";
  let packageId: string | null = null;
  let manifestUrl: string | null = null;
  let availableQualities: unknown = [];
  if (ready) {
    packageId = ready.package.id;
    manifestUrl = `/api/streaming/${ready.package.id}/master.m3u8`;
    availableQualities = JSON.parse(ready.package.renditionsJson);
  } else {
    mode = "direct";
  }

  // Close any existing active session for this profile/media so multiple
  // enters of the same title don't inflate the concurrent count.
  await db.update(playbackSessions)
    .set({ endedAt: now, revokedAt: now })
    .where(and(
      eq(playbackSessions.profileId, payload.profileId),
      eq(playbackSessions.mediaId, mediaId),
      isNull(playbackSessions.endedAt)
    ));

  await db.insert(playbackSessions).values({
    id: sessionId, packageId, mediaId, accountId: account.id, profileId: profile.id,
    mode, quality,
    expiresAt, lastSeenAt: now, createdAt: now,
  });

  const response = NextResponse.json({
    mode, sessionId, expiresAt,
    ...(mode === "hls" && manifestUrl ? { manifestUrl, availableQualities } : { streamUrl: `/api/media/${encodeURIComponent(mediaId)}/stream${episodeId ? `?episode=${encodeURIComponent(episodeId)}` : ""}` }),
  });
  response.cookies.set("mvf_playback", sessionId, { httpOnly: true,
    secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
    sameSite: "lax", path: "/api/streaming", maxAge: 7200 });
  return response;
}

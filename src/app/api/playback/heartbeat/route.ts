import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, setupDatabase } from "@/db";
import { playbackSessions } from "@/db/schema";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Lightweight heartbeat for an active playback session. The watch page calls
 * this every ~20s while playing. It refreshes last_seen_at so the live
 * "Streaming Now" / account ACTIVE-OFFLINE metrics stay accurate and stale
 * sessions expire automatically when a TV is powered off, a browser closes, or
 * a network drops (the client never sends an explicit end).
 */
export async function POST(request: NextRequest) {
  setupDatabase();
  const token = request.cookies.get("access_token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    sessionId?: unknown;
    currentTimeSeconds?: unknown;
    quality?: unknown;
  } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const currentTimeSeconds = typeof body?.currentTimeSeconds === "number" && Number.isFinite(body.currentTimeSeconds)
    ? Math.max(0, Math.floor(body.currentTimeSeconds))
    : null;
  const quality = typeof body?.quality === "string" ? body.quality : null;

  const now = new Date().toISOString();
  const result = await db.update(playbackSessions)
    .set({
      lastSeenAt: now,
      ...(currentTimeSeconds !== null ? { currentTimeSeconds } : {}),
      ...(quality ? { quality } : {}),
    })
    .where(and(
      eq(playbackSessions.id, sessionId),
      eq(playbackSessions.accountId, payload.accountId),
      eq(playbackSessions.profileId, payload.profileId),
      isNull(playbackSessions.endedAt)
    ));

  return NextResponse.json({ ok: result.changes === 1 });
}
import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, setupDatabase } from "@/db";
import { playbackSessions } from "@/db/schema";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Explicitly close an active playback session. Called on episode transition,
 * movie ended, logout, and before navigating away so the session count does
 * not linger. Stale sessions (no heartbeat) still expire via the last_seen_at
 * window in the analytics queries, so this is an optimization, not a
 * requirement for correctness.
 */
export async function POST(request: NextRequest) {
  setupDatabase();
  const token = request.cookies.get("access_token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { sessionId?: unknown } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const now = new Date().toISOString();
  await db.update(playbackSessions)
    .set({ endedAt: now, revokedAt: now })
    .where(and(
      eq(playbackSessions.id, sessionId),
      eq(playbackSessions.accountId, payload.accountId),
      eq(playbackSessions.profileId, payload.profileId),
      isNull(playbackSessions.endedAt)
    ));

  return NextResponse.json({ ok: true });
}
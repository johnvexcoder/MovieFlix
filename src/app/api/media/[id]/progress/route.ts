import { NextRequest } from "next/server";
import { db } from "@/db";
import { watchHistory } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(accessToken);
    if (!payload || !payload.profileId) {
      return errorResponse("Invalid token", 401);
    }

    const profileId = payload.profileId;
    const episodeId = request.nextUrl.searchParams.get("episode");

    let condition = and(
      eq(watchHistory.profileId, profileId),
      eq(watchHistory.mediaId, id)
    );

    if (episodeId) {
      condition = and(
        eq(watchHistory.profileId, profileId),
        eq(watchHistory.mediaId, id),
        eq(watchHistory.episodeId, episodeId)
      );
    }

    const [record] = await db
      .select()
      .from(watchHistory)
      .where(condition)
      .limit(1);

    if (!record) {
      return successResponse({
        positionSeconds: 0,
        durationSeconds: 0,
        percent: 0,
        completed: false,
      });
    }

    return successResponse({
      positionSeconds: record.positionSeconds,
      durationSeconds: record.durationSeconds,
      percent: record.percent,
      completed: record.completed,
      lastWatched: record.lastWatched,
    });
  } catch (error) {
    console.error("Get watch progress error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(accessToken);
    if (!payload || !payload.profileId) {
      return errorResponse("Invalid token", 401);
    }

    const profileId = payload.profileId;
    const body = await request.json();
    const { positionSeconds = 0, durationSeconds = 0, episodeId = null } = body;

    const pos = Math.max(0, Math.floor(positionSeconds));
    const dur = Math.max(0, Math.floor(durationSeconds));
    const percent = dur > 0 ? Math.min(100, Math.round((pos / dur) * 1000) / 10) : 0;
    const completed = percent >= 92;
    const now = new Date().toISOString();

    let condition = and(
      eq(watchHistory.profileId, profileId),
      eq(watchHistory.mediaId, id)
    );

    if (episodeId) {
      condition = and(
        eq(watchHistory.profileId, profileId),
        eq(watchHistory.mediaId, id),
        eq(watchHistory.episodeId, episodeId)
      );
    }

    const [existing] = await db
      .select()
      .from(watchHistory)
      .where(condition)
      .limit(1);

    if (existing) {
      await db
        .update(watchHistory)
        .set({
          positionSeconds: pos,
          durationSeconds: dur,
          percent,
          completed,
          lastWatched: now,
          updatedAt: now,
        })
        .where(eq(watchHistory.id, existing.id));
    } else {
      await db.insert(watchHistory).values({
        id: uuidv4(),
        profileId,
        mediaId: id,
        episodeId,
        positionSeconds: pos,
        durationSeconds: dur,
        percent,
        completed,
        lastWatched: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return successResponse({
      success: true,
      percent,
      completed,
    });
  } catch (error) {
    console.error("Save watch progress error:", error);
    return errorResponse("Internal server error", 500);
  }
}

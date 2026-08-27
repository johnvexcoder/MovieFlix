import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { media, watchHistory, profileSettings } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    // Get all media
    const allMedia = await db
      .select()
      .from(media)
      .orderBy(desc(media.createdAt));

    // Get featured (first movie with backdrop)
    const featured = allMedia.find((m) => m.backdropUrl) || allMedia[0] || null;

    // Get continue watching for this profile
    const continueWatchingEntries = await db
      .select({
        mediaId: watchHistory.mediaId,
        positionSeconds: watchHistory.positionSeconds,
        durationSeconds: watchHistory.durationSeconds,
        percent: watchHistory.percent,
        lastWatched: watchHistory.lastWatched,
      })
      .from(watchHistory)
      .where(
        and(
          eq(watchHistory.profileId, payload.profileId),
          eq(watchHistory.completed, false)
        )
      )
      .orderBy(desc(watchHistory.lastWatched))
      .limit(10);

    const continueWatching = continueWatchingEntries
      .map((entry) => {
        const mediaItem = allMedia.find((m) => m.id === entry.mediaId);
        if (!mediaItem) return null;
        return {
          ...mediaItem,
          progress: {
            percent: entry.percent,
            positionSeconds: entry.positionSeconds,
            completed: false,
            lastWatched: entry.lastWatched,
          },
        };
      })
      .filter(Boolean);

    // Recently added (last 20)
    const recentlyAdded = allMedia.slice(0, 20);

    // Trending (highest rated)
    const trending = [...allMedia]
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 20);

    // Group by genres
    const genres: Record<string, typeof allMedia> = {};
    for (const item of allMedia) {
      if (item.genres) {
        try {
          const itemGenres = JSON.parse(item.genres) as string[];
          for (const genre of itemGenres) {
            if (!genres[genre]) {
              genres[genre] = [];
            }
            genres[genre].push(item);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    // Limit each genre to 20 items
    for (const genre of Object.keys(genres)) {
      genres[genre] = genres[genre].slice(0, 20);
    }

    return successResponse({
      featured,
      continueWatching,
      recentlyAdded,
      trending,
      genres,
    });
  } catch (error) {
    console.error("Get home data error:", error);
    return errorResponse("Internal server error", 500);
  }
}

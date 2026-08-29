import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { media, seasons, episodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    const [mediaItem] = await db
      .select()
      .from(media)
      .where(eq(media.id, id))
      .limit(1);

    if (!mediaItem) {
      return errorResponse("Media not found", 404);
    }

    // If it's a series, get seasons and episodes
    let mediaSeasons: any[] = [];
    let mediaEpisodes: any[] = [];

    if (mediaItem.type === "series") {
      mediaSeasons = await db
        .select()
        .from(seasons)
        .where(eq(seasons.mediaId, id))
        .orderBy(seasons.seasonNumber);

      const rawEpisodes = await db
        .select()
        .from(episodes)
        .where(eq(episodes.mediaId, id))
        .orderBy(episodes.episodeNumber);

      // Attach seasonNumber to each episode
      const seasonNumberMap = new Map<string, number>();
      for (const season of mediaSeasons) {
        seasonNumberMap.set(season.id, season.seasonNumber);
      }

      mediaEpisodes = rawEpisodes.map((ep) => ({
        ...ep,
        seasonNumber: seasonNumberMap.get(ep.seasonId) || 0,
      }));
    }

    return successResponse({
      ...mediaItem,
      seasons: mediaSeasons,
      episodes: mediaEpisodes,
    });
  } catch (error) {
    console.error("Get media detail error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(
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
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    // Only admins can delete media
    if (!payload.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const [mediaItem] = await db
      .select()
      .from(media)
      .where(eq(media.id, id))
      .limit(1);

    if (!mediaItem) {
      return errorResponse("Media not found", 404);
    }

    // Delete associated seasons and episodes for series
    if (mediaItem.type === "series") {
      const mediaSeasons = await db
        .select()
        .from(seasons)
        .where(eq(seasons.mediaId, id));

      for (const season of mediaSeasons) {
        await db.delete(episodes).where(eq(episodes.seasonId, season.id));
      }
      await db.delete(seasons).where(eq(seasons.mediaId, id));
    }

    // Delete the media item
    await db.delete(media).where(eq(media.id, id));

    return successResponse({ message: "Media deleted successfully" });
  } catch (error) {
    console.error("Delete media error:", error);
    return errorResponse("Internal server error", 500);
  }
}
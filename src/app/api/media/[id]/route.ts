import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { media, seasons, episodes, watchHistory, myList } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

function parseGenres(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function formatGenres(genres: string[]): string {
  return genres.length > 1 ? `${genres[0]} and ${genres[1]}` : genres[0] || "similar themes";
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = request.cookies.get("access_token")?.value;
    const adminToken = request.cookies.get("admin_token")?.value;
    const token = accessToken || adminToken;
    if (!token) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(token);
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
    let mediaSeasons: (typeof seasons.$inferSelect)[] = [];
    let mediaEpisodes: ((typeof episodes.$inferSelect) & { seasonNumber: number })[] = [];

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

    const sourceGenres = parseGenres(mediaItem.genres);
    const candidates = await db.select({
      id: media.id,
      type: media.type,
      title: media.title,
      year: media.year,
      overview: media.overview,
      genres: media.genres,
      rating: media.rating,
      maturityRating: media.maturityRating,
      durationMinutes: media.durationMinutes,
      backdropUrl: media.backdropUrl,
      posterUrl: media.posterUrl,
    }).from(media);
    const recommendations = candidates
      .filter((candidate) => candidate.id !== mediaItem.id)
      .map((candidate) => {
        const shared = sourceGenres.filter((genre) => parseGenres(candidate.genres).includes(genre));
        const sameType = candidate.type === mediaItem.type;
        return {
          ...candidate,
          recommendationReason: shared.length
            ? `Because it shares ${formatGenres(shared.slice(0, 2))} with ${mediaItem.title}.`
            : sameType
              ? `A highly rated ${candidate.type === "series" ? "series" : "movie"} from your library.`
              : "A highly rated discovery from your MovieFlix library.",
          score: shared.length * 10 + (sameType ? 3 : 0) + (candidate.rating || 0) / 10,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ score: _score, ...candidate }) => candidate);

    return successResponse({
      ...mediaItem,
      seasons: mediaSeasons,
      episodes: mediaEpisodes,
      recommendations,
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
    // Admins act through the admin panel (admin_token); allow either token so
    // nothing blocks an authenticated admin from deleting media.
    const accessToken = request.cookies.get("access_token")?.value;
    const adminToken = request.cookies.get("admin_token")?.value;
    const token = accessToken || adminToken;
    if (!token) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(token);
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

    // Delete dependents within one transaction: watch_history references the
    // media row (FK), so it must go first or the delete fails with SQLite
    // foreign-key constraint errors.
    db.transaction((tx) => {
      tx.delete(myList).where(eq(myList.mediaId, id)).run();
      tx.delete(watchHistory).where(eq(watchHistory.mediaId, id)).run();

      // Delete associated seasons and episodes for series
      if (mediaItem.type === "series") {
        const mediaSeasons = tx
          .select()
          .from(seasons)
          .where(eq(seasons.mediaId, id)).all();

        for (const season of mediaSeasons) {
          tx.delete(episodes).where(eq(episodes.seasonId, season.id)).run();
        }
        tx.delete(seasons).where(eq(seasons.mediaId, id)).run();
      }

      // Delete the media item
      tx.delete(media).where(eq(media.id, id)).run();
    });

    return successResponse({ message: "Media deleted successfully" });
  } catch (error) {
    console.error("Delete media error:", error);
    return errorResponse("Internal server error", 500);
  }
}

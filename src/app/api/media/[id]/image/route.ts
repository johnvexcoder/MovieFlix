import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { media, episodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { findLocalPoster, findLocalBackdrop, resolveLocalFile } from "@/lib/local-media";

export const dynamic = "force-dynamic";

const IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Serves a local poster / backdrop image for a media item.
 * Priority:
 * 1. Stored local path in DB (posterPath/backdropPath)
 * 2. Re-scan local directory for common poster/backdrop filenames
 * 3. TMDB remote URL (302 redirect)
 * 4. 404
 *
 * ?kind=poster (default) | backdrop
 * ?episode=<episodeId> for episode-specific images
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const payload = await verifyToken(accessToken);
    if (!payload) {
      return new NextResponse("Invalid token", { status: 401 });
    }

    const kind = request.nextUrl.searchParams.get("kind") === "backdrop" ? "backdrop" : "poster";
    const episodeId = request.nextUrl.searchParams.get("episode");

    let mediaItem: any = null;
    let filePath: string | null = null;

    if (episodeId) {
      // For episodes, get the episode's file path and use the parent media's images
      const [episode] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, episodeId))
        .limit(1);

      if (episode) {
        filePath = episode.filePath;
        // Get parent media for TMDB URLs
        const [parentMedia] = await db
          .select()
          .from(media)
          .where(eq(media.id, episode.mediaId))
          .limit(1);
        mediaItem = parentMedia;
      }
    }

    if (!filePath) {
      const [mediaItemDirect] = await db
        .select()
        .from(media)
        .where(eq(media.id, id))
        .limit(1);
      mediaItem = mediaItemDirect;
      filePath = mediaItemDirect?.filePath || null;
    }

    if (!mediaItem) {
      return new NextResponse("Media not found", { status: 404 });
    }

    // 1. Try stored local path from DB
    const storedLocalPath = kind === "backdrop" ? mediaItem.backdropPath : mediaItem.posterPath;
    const resolvedStored = storedLocalPath ? resolveLocalFile(storedLocalPath) : null;
    if (resolvedStored && fs.existsSync(resolvedStored)) {
      const ext = path.extname(resolvedStored).toLowerCase();
      const mime = IMAGE_MIME[ext] || "image/jpeg";
      const buf = fs.readFileSync(resolvedStored);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "private, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // 2. Re-scan local directory for poster/backdrop if filePath is available.
    //    Resolve the stored video path first (mounts/roots can change) so the
    //    directory scan works even when the DB path is stale.
    let resolvedVideo = filePath ? resolveLocalFile(filePath) : null;
    if (!resolvedVideo) resolvedVideo = filePath && fs.existsSync(filePath) ? filePath : null;
    if (resolvedVideo) {
      const localFound = kind === "backdrop"
        ? findLocalBackdrop(resolvedVideo)
        : findLocalPoster(resolvedVideo);

      if (localFound && fs.existsSync(localFound)) {
        const ext = path.extname(localFound).toLowerCase();
        const mime = IMAGE_MIME[ext] || "image/jpeg";
        const buf = fs.readFileSync(localFound);
        return new NextResponse(new Uint8Array(buf), {
          headers: {
            "Content-Type": mime,
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }

    // 3. Fall back to remote TMDB image
    const remoteUrl = kind === "backdrop" ? mediaItem.backdropUrl : mediaItem.posterUrl;
    if (remoteUrl) {
      return NextResponse.redirect(remoteUrl, 302);
    }

    return new NextResponse("No image available", { status: 404 });
  } catch (error) {
    console.error("Poster endpoint error:", error);
    return new NextResponse("Image error", { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { media, episodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

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
 * Priority: local image on disk -> TMDB remote URL (302 redirect) -> 404.
 *
 * ?kind=poster (default) | backdrop
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

    const [mediaItem] = await db
      .select()
      .from(media)
      .where(eq(media.id, id))
      .limit(1);

    if (!mediaItem) {
      return new NextResponse("Media not found", { status: 404 });
    }

    const localPath = kind === "backdrop" ? mediaItem.backdropPath : mediaItem.posterPath;

    // Serve local file if available
    if (localPath && fs.existsSync(localPath)) {
      const ext = path.extname(localPath).toLowerCase();
      const mime = IMAGE_MIME[ext] || "image/jpeg";
      const buf = fs.readFileSync(localPath);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": mime,
          "Cache-Control": "private, max-age=86400",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // Fall back to remote TMDB image
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

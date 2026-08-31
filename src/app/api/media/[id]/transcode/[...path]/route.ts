import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { db } from "@/db";
import { media, episodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import {
  transcodeKey,
  availableHeights,
  isRenditionReady,
  ensureTranscode,
  renditionFile,
} from "@/services/transcode";

export const dynamic = "force-dynamic";

// Same download-protection posture as the raw stream endpoint.
const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

async function resolveTargetFile(id: string, episodeId: string | null) {
  let targetFilePath: string | null = null;
  let sourceHeight: number | null = null;

  if (episodeId) {
    const [ep] = await db
      .select()
      .from(episodes)
      .where(eq(episodes.id, episodeId))
      .limit(1);
    if (ep?.filePath) {
      targetFilePath = ep.filePath;
      sourceHeight = ep.videoHeight ?? null;
    }
  }

  if (!targetFilePath) {
    const [m] = await db
      .select()
      .from(media)
      .where(eq(media.id, id))
      .limit(1);
    if (m?.filePath) {
      targetFilePath = m.filePath;
      sourceHeight = m.videoHeight ?? null;
    }
  }

  if (!targetFilePath || !fs.existsSync(targetFilePath)) return null;
  return { targetFilePath, sourceHeight };
}

/**
 * GET /api/media/[id]/transcode/<height>/video.mp4
 *
 * Transcodes (on demand, cached) the source to a fragmented MP4 at the given
 * height and streams it with range + download protection. Returns 503 with
 * Retry-After while the rendition is still being produced.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; path: string[] }> }
) {
  try {
    const { id, path: segments } = await params;
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const payload = await verifyToken(accessToken);
    if (!payload) {
      return new NextResponse("Invalid token", { status: 401 });
    }

    const episodeId = request.nextUrl.searchParams.get("episode");
    const resolved = await resolveTargetFile(id, episodeId);
    if (!resolved) {
      return new NextResponse("Media file not found", { status: 404 });
    }
    const { targetFilePath, sourceHeight } = resolved;
    const key = transcodeKey(targetFilePath);

    const p = segments.map((s) => s.toLowerCase());
    const height = parseInt(p[0], 10);
    if (!availableHeights(sourceHeight).includes(height)) {
      return new NextResponse("Unsupported quality", { status: 400 });
    }
    if (p[1] !== "video.mp4") {
      return new NextResponse("Not found", { status: 404 });
    }

    // Ensure transcode is playable (kicks off on first request; cached after)
    await ensureTranscode(targetFilePath, height);

    const file = renditionFile(key, height);
    if (!isRenditionReady(key, height) || !fs.existsSync(file)) {
      return new NextResponse("Transcoding in progress", {
        status: 503,
        headers: { "Retry-After": "2" },
      });
    }

    const stat = fs.statSync(file);
    const fileSize = stat.size;
    const range = request.headers.get("range");

    // Range-tolerant: a missing Range header (some mobile browsers' first
    // probe) answers with the first capped chunk as a 206 so the browser
    // learns ranges are supported. When a Range header IS present we must
    // honour requestedStart — see stream route for the corruption note.
    let start = 0;
    let end = Math.min(start + MAX_CHUNK_BYTES - 1, fileSize - 1);

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const requestedStart = parts[0] ? parseInt(parts[0], 10) : 0;
      const requestedEnd = parts[1]
        ? parseInt(parts[1], 10)
        : Math.min(requestedStart + 1024 * 1024 * 4 - 1, fileSize - 1);

      start = Math.min(requestedStart, fileSize - 1);
      end = Math.min(requestedEnd, start + MAX_CHUNK_BYTES - 1, fileSize - 1);

      if (start > end || start >= fileSize) {
        return new NextResponse("Range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }
    }

    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(file, { start, end });
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Content-Length": String(chunkSize),
        "Content-Type": "video/mp4",
        "Accept-Ranges": "bytes",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "X-Frame-Options": "DENY",
        ReferrerPolicy: "no-referrer",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Transcode route error:", error);
    return new NextResponse("Transcode error", { status: 500 });
  }
}

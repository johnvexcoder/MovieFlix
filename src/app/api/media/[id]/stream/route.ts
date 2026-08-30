import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { media, episodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".ts": "video/mp2t",
};

// Download protection: never serve a full file in one shot. These caps force a
// browser to fetch in small range chunks, making direct file downloads infeasible.
const MAX_CHUNK_BYTES = 8 * 1024 * 1024; // 8MB per range request

const PROTECTION_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Disposition": "inline",
  "Accept-Ranges": "bytes",
  "X-Frame-Options": "DENY",
  ReferrerPolicy: "no-referrer",
};

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

    const searchParams = request.nextUrl.searchParams;
    const episodeId = searchParams.get("episode");

    let targetFilePath: string | null = null;

    if (episodeId) {
      const [episodeItem] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, episodeId))
        .limit(1);

      if (episodeItem && episodeItem.filePath) {
        targetFilePath = episodeItem.filePath;
      }
    }

    if (!targetFilePath) {
      const [mediaItem] = await db
        .select()
        .from(media)
        .where(eq(media.id, id))
        .limit(1);

      if (mediaItem && mediaItem.filePath) {
        targetFilePath = mediaItem.filePath;
      }
    }

    if (!targetFilePath) {
      return new NextResponse("Media file not found in database", { status: 404 });
    }

    if (!fs.existsSync(/*turbopackIgnore: true*/ targetFilePath)) {
      return new NextResponse("File missing on storage drive", { status: 404 });
    }

    const stat = fs.statSync(/*turbopackIgnore: true*/ targetFilePath);
    const fileSize = stat.size;
    const ext = path.extname(targetFilePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "video/mp4";

    const range = request.headers.get("range");

    // Range-tolerant streaming: some mobile browsers' first request (and any
    // probing request) omits the Range header. Instead of rejecting with 400,
    // answer with the first capped chunk as a 206 — the browser learns the
    // resource supports ranges and continues with normal range requests. The
    // 8MB chunk cap still prevents full-file download in a single request.
    const start = 0;
    let end = Math.min(start + MAX_CHUNK_BYTES - 1, fileSize - 1);

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const requestedStart = parts[0] ? parseInt(parts[0], 10) : 0;
      const requestedEnd = parts[1] ? parseInt(parts[1], 10) : Math.min(requestedStart + 1024 * 1024 * 4 - 1, fileSize - 1);
      end = Math.min(requestedEnd, requestedStart + MAX_CHUNK_BYTES - 1, fileSize - 1);

      if (requestedStart > end || requestedStart >= fileSize) {
        return new NextResponse("Range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }
    }

    const chunkSize = end - start + 1;
    const fileStream = fs.createReadStream(/*turbopackIgnore: true*/ targetFilePath, { start, end });

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
        "Content-Type": contentType,
        ...PROTECTION_HEADERS,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Video stream error:", error);
    return new NextResponse("Stream error", { status: 500 });
  }
}

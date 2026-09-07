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

    // Some Smart TV engines make an initial request without Range and require
    // a standards-compliant 200 response. Sending an unsolicited partial 206
    // makes those engines treat the first chunk as the whole movie and jump to
    // the end. Stream the full file for that probe; browsers that support
    // seeking use the bounded 206 path below.
    if (!range) {
      const fileStream = fs.createReadStream(/*turbopackIgnore: true*/ targetFilePath);
      const webStream = new ReadableStream({
        start(controller) {
          fileStream.on("data", (chunk) => controller.enqueue(chunk));
          fileStream.on("end", () => controller.close());
          fileStream.on("error", (err) => controller.error(err));
        },
        cancel() { fileStream.destroy(); },
      });
      return new NextResponse(webStream, {
        status: 200,
        headers: {
          "Content-Length": String(fileSize),
          "Content-Type": contentType,
          ...PROTECTION_HEADERS,
          "Cache-Control": "private, no-cache",
        },
      });
    }

    const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim());
    if (!match || (!match[1] && !match[2])) {
      return new NextResponse("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    let start: number;
    let requestedEnd: number;
    if (!match[1]) {
      const suffixLength = Number(match[2]);
      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
        return new NextResponse("Range not satisfiable", {
          status: 416,
          headers: { "Content-Range": `bytes */${fileSize}` },
        });
      }
      start = Math.max(0, fileSize - suffixLength);
      requestedEnd = fileSize - 1;
    } else {
      start = Number(match[1]);
      requestedEnd = match[2] ? Number(match[2]) : fileSize - 1;
    }

    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= fileSize || requestedEnd < start) {
      return new NextResponse("Range not satisfiable", {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const end = Math.min(requestedEnd, start + MAX_CHUNK_BYTES - 1, fileSize - 1);

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

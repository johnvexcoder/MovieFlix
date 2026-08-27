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

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024 * 4 - 1, fileSize - 1); // 4MB chunks

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
          "Accept-Ranges": "bytes",
          "Content-Length": String(chunkSize),
          "Content-Type": contentType,
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    const fileStream = fs.createReadStream(/*turbopackIgnore: true*/ targetFilePath);
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
      status: 200,
      headers: {
        "Content-Length": String(fileSize),
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error) {
    console.error("Video stream error:", error);
    return new NextResponse("Stream error", { status: 500 });
  }
}

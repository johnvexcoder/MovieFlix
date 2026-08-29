import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/db";
import { media, episodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { findLocalSubtitles } from "@/lib/local-media";

export const dynamic = "force-dynamic";

/**
 * Subtitle endpoints for a media item.
 *
 * GET /api/media/[id]/subtitles
 *   -> list of available local subtitle tracks (no file param)
 *
 * GET /api/media/[id]/subtitles?file=<base64-encoded-abs-path>
 *   -> returns the actual .srt/.vtt content for the player <track> element
 *
 * Optional ?episode=<episodeId> to look up subtitles for an episode's file.
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

    const searchParams = request.nextUrl.searchParams;
    const episodeId = searchParams.get("episode");

    let targetFilePath: string | null = null;

    if (episodeId) {
      const [episodeItem] = await db
        .select()
        .from(episodes)
        .where(eq(episodes.id, episodeId))
        .limit(1);
      if (episodeItem?.filePath) targetFilePath = episodeItem.filePath;
    }

    if (!targetFilePath) {
      const [mediaItem] = await db
        .select()
        .from(media)
        .where(eq(media.id, id))
        .limit(1);
      if (mediaItem?.filePath) targetFilePath = mediaItem.filePath;
    }

    if (!targetFilePath) {
      return new NextResponse("Media not found", { status: 404 });
    }

    const fileParam = searchParams.get("file");

    // Serving a specific subtitle file
    if (fileParam) {
      let filePath: string;
      try {
        filePath = Buffer.from(fileParam, "base64").toString("utf-8");
      } catch {
        return new NextResponse("Bad request", { status: 400 });
      }

      // Only allow files that are recognized subtitle files in the media's directory
      if (!/\.(srt|vtt)$/i.test(filePath)) {
        return new NextResponse("Not a subtitle file", { status: 400 });
      }

      const dir = targetFilePath ? dirnameOf(targetFilePath) : "";
      const safeDir = path.resolve(dir);
      const safeFile = path.resolve(filePath);

      // Resolve symlinks on both sides so a link pointing outside the media
      // directory cannot bypass the containment check.
      const resolvedDir = fs.existsSync(safeDir) ? fs.realpathSync(safeDir) : safeDir;
      const resolvedFile = fs.existsSync(safeFile) ? fs.realpathSync(safeFile) : safeFile;

      // Strict descendant check: the requested file must live inside the
      // media's own directory (a trailing separator prevents the classic
      // prefix-byte collision, e.g. /media/movie-vs-movie2).
      if (!resolvedFile.startsWith(resolvedDir + path.sep)) {
        return new NextResponse("Forbidden", { status: 403 });
      }

      if (!fs.existsSync(resolvedFile) || !fs.statSync(resolvedFile).isFile()) {
        return new NextResponse("Subtitle file not found", { status: 404 });
      }

      const content = fs.readFileSync(resolvedFile, "utf-8");
      const isVtt = /\.vtt$/.test(resolvedFile);
      let body = content;

      // Convert SRT to WebVTT so the browser <track> can render it
      if (!isVtt) {
        body = srtToVtt(content);
      }

      return new NextResponse(body, {
        headers: {
          "Content-Type": "text/vtt; charset=utf-8",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Listing available subtitles
    const subs = findLocalSubtitles(targetFilePath).map((s) => ({
      file: Buffer.from(s.filePath, "utf-8").toString("base64"),
      lang: s.lang,
      label: s.label,
    }));

    return NextResponse.json({ success: true, data: { subtitles: subs } });
  } catch (error) {
    console.error("Subtitle endpoint error:", error);
    return new NextResponse("Subtitle error", { status: 500 });
  }
}

function dirnameOf(p: string): string {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx >= 0 ? p.slice(0, idx) : p;
}

function srtToVtt(srt: string): string {
  let vtt = "WEBVTT\n\n";
  const cleaned = srt.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const blocks = cleaned.split(/\n{2,}/);

  for (const rawBlock of blocks) {
    const lines = rawBlock.split("\n").filter((l) => l.length > 0);
    if (lines.length === 0) continue;

    // Skip numeric index lines
    let bodyStart = 0;
    if (/^\d+$/.test(lines[0])) {
      bodyStart = 1;
    }

    const timeIdx = lines.findIndex((l, i) => i >= bodyStart && /-->/.test(l));
    if (timeIdx === -1) continue;

    const time = lines[timeIdx].replace(/,/g, ".").trim();
    // Ensure cue with no end time is excluded or given a default
    const text = lines.slice(timeIdx + 1).join("\n");
    vtt += `${time}\n${text}\n\n`;
  }

  return vtt;
}

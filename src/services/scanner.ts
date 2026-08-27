import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { media, seasons, episodes, scanLog, libraryConfig } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { parseFilename, isVideoFile, extractSeasonFromPath } from "./filename-parser";
import { probeFile, needsTranscode, generateThumbnail } from "./ffmpeg-probe";
import { searchMovie, searchTV, getSeasonDetails } from "./tmdb";
import type { ScanLog } from "@/types";

let currentScan: ScanLog | null = null;

export async function startScan(triggeredBy: "auto" | "manual" = "manual"): Promise<string> {
  if (currentScan?.status === "running") {
    throw new Error("Scan already in progress");
  }

  const scanId = uuidv4();
  const now = new Date().toISOString();

  await db.insert(scanLog).values({
    id: scanId,
    status: "running",
    mediaFound: 0,
    mediaAdded: 0,
    mediaUpdated: 0,
    mediaSkipped: 0,
    errors: null,
    startedAt: now,
    triggeredBy,
  });

  currentScan = {
    id: scanId,
    status: "running",
    mediaFound: 0,
    mediaAdded: 0,
    mediaUpdated: 0,
    mediaSkipped: 0,
    errors: null,
    startedAt: now,
    completedAt: null,
    triggeredBy,
  };

  // Run scan in background
  runScan(scanId).catch((error) => {
    console.error("Scan error:", error);
    updateScanStatus(scanId, "failed", { error: error.message });
  });

  return scanId;
}

async function runScan(scanId: string) {
  const errors: string[] = [];

  try {
    // Get enabled library paths
    const libraries = await db
      .select()
      .from(libraryConfig)
      .where(eq(libraryConfig.enabled, true));

    for (const lib of libraries) {
      try {
        await scanDirectory(scanId, lib.path, lib.type as "movies" | "series");
      } catch (error) {
        const errorMsg = `Error scanning ${lib.path}: ${error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    await updateScanStatus(scanId, "completed", { errors });
  } catch (error) {
    await updateScanStatus(scanId, "failed", { error: String(error) });
  }
}

async function scanDirectory(
  scanId: string,
  dirPath: string,
  type: "movies" | "series"
) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    console.error(`Cannot read directory ${dirPath}:`, error);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      await scanDirectory(scanId, fullPath, type);
    } else if (entry.isFile() && isVideoFile(entry.name)) {
      await processFile(scanId, fullPath, type);
    }
  }
}

async function processFile(
  scanId: string,
  filePath: string,
  type: "movies" | "series"
) {
  // Check if file already exists in database
  const [existing] = await db
    .select()
    .from(media)
    .where(eq(media.filePath, filePath))
    .limit(1);

  if (existing) {
    updateScanCounter(scanId, "skipped");
    return;
  }

  // Parse filename
  const parsed = parseFilename(filePath);
  const fileType = type === "series" ? "series" : parsed.type;

  // Probe file for metadata
  const probe = await probeFile(filePath);

  // Generate thumbnail
  const thumbnailDir = path.join(process.cwd(), "data", "thumbnails");
  const thumbnailName = `${uuidv4()}.jpg`;
  const thumbnailPath = path.join(thumbnailDir, thumbnailName);
  await generateThumbnail(filePath, thumbnailPath);

  // Fetch TMDB metadata
  let tmdbData = null;
  if (parsed.title) {
    if (fileType === "series") {
      tmdbData = await searchTV(parsed.title);
    } else {
      tmdbData = await searchMovie(parsed.title, parsed.year || undefined);
    }
  }

  const mediaId = uuidv4();
  const now = new Date().toISOString();

  // Create media entry
  await db.insert(media).values({
    id: mediaId,
    type: fileType,
    title: tmdbData?.title || parsed.title,
    year: tmdbData?.year || parsed.year,
    overview: tmdbData?.overview || null,
    genres: tmdbData?.genres ? JSON.stringify(tmdbData.genres) : null,
    rating: tmdbData?.rating || null,
    maturityRating: tmdbData?.maturityRating || null,
    durationMinutes: tmdbData?.durationMinutes || (probe ? Math.round(probe.duration / 60) : null),
    backdropUrl: tmdbData?.backdropUrl || null,
    posterUrl: tmdbData?.posterUrl || null,
    trailerUrl: tmdbData?.trailerUrl || null,
    tmdbId: tmdbData?.tmdbId || null,
    filePath,
    fileSize: probe?.size || null,
    fileCodec: probe?.videoCodec || null,
    fileContainer: probe?.container || null,
    fileDurationSeconds: probe?.duration || null,
    fileBitrate: probe?.bitrate || null,
    videoCodec: probe?.videoCodec || null,
    videoWidth: probe?.width || null,
    videoHeight: probe?.height || null,
    audioCodec: probe?.audioCodec || null,
    thumbnailPath: thumbnailPath,
    backdropPath: null,
    posterPath: null,
    needsTranscode: probe ? needsTranscode(probe) : false,
    scanId,
    createdAt: now,
    updatedAt: now,
  });

  updateScanCounter(scanId, "added");

  // If it's a series, fetch season/episode details
  if (fileType === "series" && tmdbData?.tmdbId) {
    await processSeriesEpisode(
      mediaId,
      tmdbData.tmdbId,
      parsed.season,
      parsed.episode,
      filePath
    );
  }
}

async function processSeriesEpisode(
  mediaId: string,
  tmdbId: number,
  seasonNum: number | null,
  episodeNum: number | null,
  filePath: string
) {
  if (!seasonNum || !episodeNum) return;

  // Get or create season
  const [existingSeason] = await db
    .select()
    .from(seasons)
    .where(
      and(
        eq(seasons.mediaId, mediaId),
        eq(seasons.seasonNumber, seasonNum)
      )
    )
    .limit(1);

  let seasonId = existingSeason?.id;

  if (!existingSeason) {
    const seasonDetails = await getSeasonDetails(tmdbId, seasonNum);
    seasonId = uuidv4();

    await db.insert(seasons).values({
      id: seasonId,
      mediaId,
      seasonNumber: seasonNum,
      title: seasonDetails?.name || `Season ${seasonNum}`,
      overview: seasonDetails?.overview || null,
      posterUrl: null,
      posterPath: null,
      tmdbId,
      year: null,
      createdAt: new Date().toISOString(),
    });
  }

  // Get episode details from TMDB
  const seasonDetails = await getSeasonDetails(tmdbId, seasonNum);
  const episodeDetails = seasonDetails?.episodes?.find(
    (e) => e.episode_number === episodeNum
  );

  // Create episode entry
  await db.insert(episodes).values({
    id: uuidv4(),
    mediaId,
    seasonId: seasonId!,
    episodeNumber: episodeNum,
    title: episodeDetails?.name || `Episode ${episodeNum}`,
    overview: episodeDetails?.overview || null,
    durationMinutes: episodeDetails?.runtime || null,
    stillUrl: episodeDetails?.still_path
      ? `https://image.tmdb.org/t/p/w300${episodeDetails.still_path}`
      : null,
    stillPath: null,
    filePath,
    fileSize: null,
    fileCodec: null,
    fileContainer: null,
    fileDurationSeconds: null,
    videoCodec: null,
    videoWidth: null,
    videoHeight: null,
    audioCodec: null,
    tmdbId: tmdbId,
    thumbnailPath: null,
    needsTranscode: false,
    createdAt: new Date().toISOString(),
  });
}

function updateScanCounter(scanId: string, type: "found" | "added" | "updated" | "skipped") {
  const field =
    type === "found"
      ? "mediaFound"
      : type === "added"
        ? "mediaAdded"
        : type === "updated"
          ? "mediaUpdated"
          : "mediaSkipped";

  // Increment counter (simplified - in production use SQL increment)
  if (currentScan) {
    currentScan[field] = (currentScan[field] || 0) + 1;
  }
}

async function updateScanStatus(
  scanId: string,
  status: "completed" | "failed" | "cancelled",
  details?: { errors?: string[]; error?: string }
) {
  const now = new Date().toISOString();
  const errors = details?.errors || (details?.error ? [details.error] : null);

  await db
    .update(scanLog)
    .set({
      status,
      completedAt: now,
      errors: errors ? JSON.stringify(errors) : null,
    })
    .where(eq(scanLog.id, scanId));

  if (currentScan) {
    currentScan.status = status;
    currentScan.completedAt = now;
    currentScan.errors = errors ? JSON.stringify(errors) : null;
  }
}

export function getScanStatus(): ScanLog | null {
  return currentScan;
}

export async function getScanHistory(): Promise<ScanLog[]> {
  const results = await db.select().from(scanLog).orderBy(scanLog.startedAt).limit(50);
  return results as ScanLog[];
}

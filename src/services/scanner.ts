import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { media, seasons, episodes, watchHistory, myList, scanLog, libraryConfig } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { parseFilename, isVideoFile, seriesIdentity } from "./filename-parser";
import { probeFile, needsTranscode, generateThumbnail } from "./ffmpeg-probe";
import { searchMovie, searchTV, getSeasonDetails } from "./tmdb";
import { findLocalPoster, findLocalBackdrop } from "@/lib/local-media";
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

    // Repair older scans that stored each episode as a separate series title.
    await organizeExistingSeries();

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
      updateScanCounter(scanId, "found");
      await processFile(scanId, fullPath, type);
    }
  }
}

async function processFile(
  scanId: string,
  filePath: string,
  type: "movies" | "series"
) {
  const [existingEpisode] = await db.select({ id: episodes.id }).from(episodes)
    .where(eq(episodes.filePath, filePath)).limit(1);
  if (existingEpisode) { updateScanCounter(scanId, "skipped"); return; }
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
  const parsed = seriesIdentity(filePath) || parseFilename(filePath);
  const fileType = type === "series" ? "series" : parsed.type;

  // Probe file for metadata
  const probe = await probeFile(filePath);

  // Generate thumbnail
  const thumbnailDir = path.join(process.cwd(), "data", "thumbnails");
  const thumbnailName = `${uuidv4()}.jpg`;
  const thumbnailPath = path.join(thumbnailDir, thumbnailName);
  await generateThumbnail(filePath, thumbnailPath);

  if (fileType === "series" && parsed.episode && parsed.title) {
    const [series] = await db.select().from(media)
      .where(and(eq(media.type, "series"), eq(media.hiddenFromCatalog, false),
        sql`lower(${media.title}) = ${parsed.title.toLowerCase()}`)).limit(1);
    if (series) {
      await addEpisode(series.id, series.tmdbId, parsed.season || 1,
        parsed.episode, filePath, probe, thumbnailPath);
      updateScanCounter(scanId, "added");
      return;
    }
  }

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

  // Local poster / backdrop fallback images (adjacent to the video file)
  const localPoster = findLocalPoster(filePath);
  const localBackdrop = findLocalBackdrop(filePath);

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
    backdropPath: localBackdrop || null,
    posterPath: localPoster || null,
    needsTranscode: probe ? needsTranscode(probe) : false,
    scanId,
    createdAt: now,
    updatedAt: now,
  });

  updateScanCounter(scanId, "added");

  // If it's a series, fetch season/episode details
  if (fileType === "series" && parsed.episode) {
    await addEpisode(mediaId, tmdbData?.tmdbId || null,
      parsed.season || 1, parsed.episode, filePath, probe, thumbnailPath);
  }
}

async function addEpisode(
  mediaId: string,
  tmdbId: number | null,
  seasonNum: number,
  episodeNum: number,
  filePath: string,
  probe: Awaited<ReturnType<typeof probeFile>>,
  thumbnailPath: string | null,
) {
  const [byPath] = await db.select({ id: episodes.id }).from(episodes)
    .where(eq(episodes.filePath, filePath)).limit(1);
  if (byPath) return;

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
    const seasonDetails = tmdbId ? await getSeasonDetails(tmdbId, seasonNum) : null;
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
  const seasonDetails = tmdbId ? await getSeasonDetails(tmdbId, seasonNum) : null;
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
    fileSize: probe?.size || null,
    fileCodec: probe?.videoCodec || null,
    fileContainer: probe?.container || null,
    fileDurationSeconds: probe?.duration || null,
    videoCodec: probe?.videoCodec || null,
    videoWidth: probe?.width || null,
    videoHeight: probe?.height || null,
    audioCodec: probe?.audioCodec || null,
    tmdbId: tmdbId,
    thumbnailPath,
    needsTranscode: probe ? needsTranscode(probe) : false,
    createdAt: new Date().toISOString(),
  });
}

/** Idempotent repair for older imports that made E01/E02 separate media rows. */
export async function organizeExistingSeries() {
  const titles = await db.select().from(media).where(eq(media.type, "series"));
  const groups = new Map<string, { title: string; rows: { item: typeof titles[number]; season: number; episode: number }[] }>();
  for (const item of titles) {
    const identity = seriesIdentity(item.filePath);
    if (!identity?.episode || !identity.title) continue;
    const key = identity.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
    const group = groups.get(key) || { title: identity.title, rows: [] };
    group.rows.push({ item, season: identity.season || 1, episode: identity.episode });
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.rows.sort((a, b) => a.item.createdAt.localeCompare(b.item.createdAt) ||
      a.episode - b.episode);
    // Keep an existing proper series entry when a previous import created one.
    const existingSeries = titles.find((item) => item.type === "series" &&
      !item.hiddenFromCatalog && !seriesIdentity(item.filePath)?.episode &&
      item.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "") ===
        group.title.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ""));
    const canonical = existingSeries || group.rows.find((row) => !row.item.hiddenFromCatalog)?.item || group.rows[0].item;
    await db.update(media).set({ title: group.title, hiddenFromCatalog: false,
      updatedAt: new Date().toISOString() }).where(eq(media.id, canonical.id));
    for (const row of group.rows) {
      const [linked] = await db.select().from(episodes)
        .where(eq(episodes.filePath, row.item.filePath)).limit(1);
      if (linked && linked.mediaId !== canonical.id) {
        const [season] = await db.select().from(seasons)
          .where(and(eq(seasons.mediaId, canonical.id), eq(seasons.seasonNumber, row.season))).limit(1);
        const seasonId = season?.id || uuidv4();
        if (!season) await db.insert(seasons).values({ id: seasonId, mediaId: canonical.id,
          seasonNumber: row.season, title: `Season ${row.season}`, createdAt: new Date().toISOString() });
        await db.update(episodes).set({ mediaId: canonical.id, seasonId })
          .where(eq(episodes.id, linked.id));
      } else if (!linked) {
        await addEpisode(canonical.id, null, row.season, row.episode,
          row.item.filePath, null, row.item.thumbnailPath);
      }
      if (row.item.id === canonical.id) continue;
      const history = await db.select().from(watchHistory)
        .where(eq(watchHistory.mediaId, row.item.id));
      const [episode] = await db.select({ id: episodes.id }).from(episodes)
        .where(eq(episodes.filePath, row.item.filePath)).limit(1);
      for (const entry of history) {
        await db.update(watchHistory).set({ mediaId: canonical.id,
          episodeId: episode?.id || entry.episodeId }).where(eq(watchHistory.id, entry.id));
      }
      await db.update(myList).set({ mediaId: canonical.id })
        .where(eq(myList.mediaId, row.item.id));
      await db.update(media).set({ hiddenFromCatalog: true,
        updatedAt: new Date().toISOString() }).where(eq(media.id, row.item.id));
    }
  }
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
      mediaFound: currentScan?.mediaFound ?? 0,
      mediaAdded: currentScan?.mediaAdded ?? 0,
      mediaUpdated: currentScan?.mediaUpdated ?? 0,
      mediaSkipped: currentScan?.mediaSkipped ?? 0,
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

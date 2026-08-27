import type { ParsedFilename } from "@/types";

const VIDEO_EXTENSIONS = [
  ".mkv", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v",
];

const QUALITY_TAGS = [
  "2160p", "1080p", "720p", "480p", "4k", "uhd",
  "bluray", "blu-ray", "bdrip", "brrip",
  "web-dl", "webdl", "webrip", "web",
  "hdtv", "hdrip",
  "dvdrip", "dvd",
  "hdcam", "cam", "ts", "tc",
  "hdrip", "proper", "repack",
  "remux", "hdr", "hdr10", "dolby", "atmos",
  "dts", "dts-hd", "truehd", "flac", "aac", "ac3", "eac3",
  "x264", "x265", "h264", "h265", "hevc", "av1", "vp9",
];

const SOURCE_TAGS = [
  "bluray", "blu-ray", "bdrip", "brrip",
  "web-dl", "webdl", "webrip",
  "hdtv", "dvdrip", "hdrip",
  "remux", "proper", "repack",
];

export function parseFilename(filePath: string): ParsedFilename {
  const fileName = filePath.split(/[/\\]/).pop() || "";
  const ext = fileName.match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";

  if (!VIDEO_EXTENSIONS.includes(ext)) {
    return {
      title: fileName.replace(/\.[^.]+$/, ""),
      year: null,
      season: null,
      episode: null,
      episodeEnd: null,
      type: "movie",
      quality: null,
      source: null,
    };
  }

  const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");
  const cleaned = cleanFileName(nameWithoutExt);

  // Try series patterns first
  const seriesResult = tryParseSeries(nameWithoutExt, cleaned);
  if (seriesResult) {
    return seriesResult;
  }

  // Try movie patterns
  const movieResult = tryParseMovie(nameWithoutExt, cleaned);
  if (movieResult) {
    return movieResult;
  }

  // Fallback: use cleaned name as title
  return {
    title: cleaned.title,
    year: cleaned.year,
    season: null,
    episode: null,
    episodeEnd: null,
    type: "movie",
    quality: cleaned.quality,
    source: cleaned.source,
  };
}

function cleanFileName(name: string): {
  title: string;
  year: number | null;
  quality: string | null;
  source: string | null;
} {
  let cleaned = name;

  // Replace dots and underscores with spaces
  cleaned = cleaned.replace(/[._]/g, " ");

  // Remove quality tags
  let quality: string | null = null;
  for (const tag of QUALITY_TAGS) {
    const regex = new RegExp(`\\b${tag}\\b`, "i");
    const match = cleaned.match(regex);
    if (match) {
      quality = match[0];
      cleaned = cleaned.replace(regex, "");
    }
  }

  // Remove source tags
  let source: string | null = null;
  for (const tag of SOURCE_TAGS) {
    const regex = new RegExp(`\\b${tag}\\b`, "i");
    const match = cleaned.match(regex);
    if (match) {
      source = match[0];
      cleaned = cleaned.replace(regex, "");
    }
  }

  // Extract year
  let year: number | null = null;
  const yearMatch = cleaned.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[0]);
    cleaned = cleaned.replace(yearMatch[0], "");
  }

  // Remove extra whitespace and special characters
  cleaned = cleaned.replace(/[\-–—()[\]{}]/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return { title: cleaned, year, quality, source };
}

function tryParseSeries(
  original: string,
  cleaned: { title: string; year: number | null; quality: string | null; source: string | null }
): ParsedFilename | null {
  // Pattern: Title.S01E01.ext or Title.S01E01E02.ext
  const seriesMatch1 = original.match(
    /^(.+?)[\s._-]+S(\d{1,2})E(\d{1,3})(?:-?E(\d{1,3}))?[\s._-]*$/i
  );

  if (seriesMatch1) {
    const title = seriesMatch1[1]
      .replace(/[._]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      title,
      year: cleaned.year,
      season: parseInt(seriesMatch1[2]),
      episode: parseInt(seriesMatch1[3]),
      episodeEnd: seriesMatch1[4] ? parseInt(seriesMatch1[4]) : null,
      type: "series",
      quality: cleaned.quality,
      source: cleaned.source,
    };
  }

  // Pattern: Title - S01E01 - Episode.ext
  const seriesMatch2 = original.match(
    /^(.+?)\s*-\s*S(\d{1,2})E(\d{1,3})\s*(?:-\s*.+)?$/i
  );

  if (seriesMatch2) {
    const title = seriesMatch2[1]
      .replace(/[._]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      title,
      year: cleaned.year,
      season: parseInt(seriesMatch2[2]),
      episode: parseInt(seriesMatch2[3]),
      episodeEnd: null,
      type: "series",
      quality: cleaned.quality,
      source: cleaned.source,
    };
  }

  // Pattern: Title - 1x01.ext
  const seriesMatch3 = original.match(
    /^(.+?)\s*-\s*(\d{1,2})x(\d{1,3})[\s._-]*$/i
  );

  if (seriesMatch3) {
    const title = seriesMatch3[1]
      .replace(/[._]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      title,
      year: cleaned.year,
      season: parseInt(seriesMatch3[2]),
      episode: parseInt(seriesMatch3[3]),
      episodeEnd: null,
      type: "series",
      quality: cleaned.quality,
      source: cleaned.source,
    };
  }

  return null;
}

function tryParseMovie(
  original: string,
  cleaned: { title: string; year: number | null; quality: string | null; source: string | null }
): ParsedFilename | null {
  // Pattern: Title (Year).ext
  const movieMatch1 = original.match(
    /^(.+?)[\s._-]+\(?(\d{4})\)?[\s._-]*$/i
  );

  if (movieMatch1) {
    const title = movieMatch1[1]
      .replace(/[._]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      title,
      year: parseInt(movieMatch1[2]),
      season: null,
      episode: null,
      episodeEnd: null,
      type: "movie",
      quality: cleaned.quality,
      source: cleaned.source,
    };
  }

  // Pattern: Title.Year.Quality.ext
  const movieMatch2 = original.match(
    /^(.+?)[\s._-]+(\d{4})[\s._-]+(?:\d{3,4}p|blu|web|dvd|hdr)[\s._-]*$/i
  );

  if (movieMatch2) {
    const title = movieMatch2[1]
      .replace(/[._]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      title,
      year: parseInt(movieMatch2[2]),
      season: null,
      episode: null,
      episodeEnd: null,
      type: "movie",
      quality: cleaned.quality,
      source: cleaned.source,
    };
  }

  // Pattern: Title - Year.ext
  const movieMatch3 = original.match(
    /^(.+?)\s*-\s*(\d{4})[\s._-]*$/i
  );

  if (movieMatch3) {
    const title = movieMatch3[1]
      .replace(/[._]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      title,
      year: parseInt(movieMatch3[2]),
      season: null,
      episode: null,
      episodeEnd: null,
      type: "movie",
      quality: cleaned.quality,
      source: cleaned.source,
    };
  }

  // Pattern: Title [Year] ext
  const movieMatch4 = original.match(
    /^(.+?)\s*\[(\d{4})\]\s*$/i
  );

  if (movieMatch4) {
    const title = movieMatch4[1]
      .replace(/[._]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      title,
      year: parseInt(movieMatch4[2]),
      season: null,
      episode: null,
      episodeEnd: null,
      type: "movie",
      quality: cleaned.quality,
      source: cleaned.source,
    };
  }

  return null;
}

export function extractSeasonFromPath(filePath: string): number | null {
  const seasonMatch = filePath.match(/Season\s*(\d{1,2})/i);
  if (seasonMatch) {
    return parseInt(seasonMatch[1]);
  }

  const seasonMatch2 = filePath.match(/S(\d{1,2})/i);
  if (seasonMatch2) {
    return parseInt(seasonMatch2[1]);
  }

  return null;
}

export function isVideoFile(filePath: string): boolean {
  const ext = filePath.match(/\.[^.]+$/)?.[0]?.toLowerCase() || "";
  return VIDEO_EXTENSIONS.includes(ext);
}

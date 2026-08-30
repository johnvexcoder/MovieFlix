import fs from "fs";
import path from "path";

const POSTER_FILENAMES = [
  "poster.jpg",
  "poster.png",
  "poster.webp",
  "folder.jpg",
  "folder.png",
  "cover.jpg",
  "cover.png",
  "fanart.jpg",
  "fanart.png",
];

const BACKDROP_FILENAMES = [
  "backdrop.jpg",
  "backdrop.png",
  "backdrop.webp",
  "fanart.jpg",
  "fanart.png",
  "background.jpg",
];

const SUBTITLE_FILENAMES = /\.(srt|vtt)$/i;

export function isLocalImageFile(name: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

/**
 * Normalize a video/search base name into a comparable token for fuzzy matching:
 * lowercase, alphanumeric only, and sections in brackets removed.
 */
function normalizeStem(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\[\(].*?[\]\)]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^ +| +$| +/g, " ")
    .trim();
}

/**
 * Resolve a stored local path from the DB to an actual file that exists on
 * this machine. Media can be rescanned/re-mounted at different roots, so we
 * try, in order:
 *   1. the path as stored (absolute)
 *   2. relative to process.cwd()
 *   3. relative to each enabled library root from the DB (longest match wins)
 */
export function resolveLocalFile(filePath: string): string | null {
  if (!filePath) return null;
  try {
    if (fs.existsSync(filePath)) return filePath;

    const cwdResolved = path.resolve(process.cwd(), filePath);
    if (fs.existsSync(cwdResolved)) return cwdResolved;

    // Try each configured library root as a candidate prefix.
    const candidates: { root: string; relative: string }[] = [];
    const libs = loadLibraryRoots();
    for (const lib of libs) {
      if (filePath.startsWith(lib + path.sep)) {
        candidates.push({ root: lib, relative: filePath });
      } else {
        candidates.push({ root: lib, relative: filePath.replace(/^[./\\]+/, "") });
      }
    }
    // Prefer the longest matching root so the most specific mount wins.
    candidates.sort((a, b) => b.root.length - a.root.length);
    for (const c of candidates) {
      const candidate = path.resolve(c.root, c.relative);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // ignore path resolution / fs errors
  }
  return null;
}

function loadLibraryRoots(): string[] {
  try {
    // Lazy import to avoid pulling the DB at module load time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqlite = require("better-sqlite3");
    const rawPath = process.env.DATABASE_PATH || process.env.DATABASE_URL || "./data/database.sqlite";
    const dbPath = rawPath.startsWith("file:") ? rawPath.replace(/^file:/, "") : rawPath;
    if (!fs.existsSync(dbPath)) return [];
    const db = new sqlite(dbPath, { readonly: true });
    const rows = db.prepare("SELECT path FROM library_config WHERE enabled = 1").all() as { path: string }[];
    db.close();
    return (rows || []).map((r) => r.path).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Find the best-guess poster image adjacent to a media file.
 * Looks for the movie's base name (e.g. "Movie (2020).jpg") or common
 * filenames (poster.jpg, folder.jpg) in the same directory.
 */
export function findLocalPoster(videoFilePath: string): string | null {
  const dir = path.dirname(videoFilePath);
  const base = path.basename(videoFilePath, path.extname(videoFilePath));
  const baseToken = normalizeStem(base);

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }

  // 1. Poster matching the video's base name exactly
  for (const file of entries) {
    const stem = path.basename(file, path.extname(file)).toLowerCase();
    if (stem === base.toLowerCase() && isLocalImageFile(file)) {
      return path.join(dir, file);
    }
  }

  // 2. Common poster filenames
  for (const name of POSTER_FILENAMES) {
    const found = entries.find((f) => f.toLowerCase() === name);
    if (found) return path.join(dir, found);
  }

  // 3. Fuzzy: any image whose stem shares the video's normalized title token
  //    (accepts e.g. "Movie (2020) [2160p].jpg" for file "Movie (2020).mkv")
  const imageFiles = entries.filter((f) => isLocalImageFile(f));
  let best: { file: string; score: number } | null = null;
  for (const file of imageFiles) {
    const fileToken = normalizeStem(path.basename(file, path.extname(file)));
    if (!fileToken) continue;
    const baseWords = baseToken.split(" ").filter((w) => w.length > 1);
    let score = 0;
    for (const word of baseWords) {
      if (fileToken.split(" ").includes(word)) score++;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { file, score };
    }
  }
  if (best) return path.join(dir, best.file);

  return null;
}

/**
 * Find the best-guess backdrop image adjacent to a media file.
 */
export function findLocalBackdrop(videoFilePath: string): string | null {
  const dir = path.dirname(videoFilePath);
  const base = path.basename(videoFilePath, path.extname(videoFilePath));
  const baseToken = normalizeStem(base);

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }

  for (const name of BACKDROP_FILENAMES) {
    const found = entries.find((f) => f.toLowerCase() === name);
    if (found) return path.join(dir, found);
  }

  // Fuzzy: prefer a wide image adjacent to the video sharing its title token
  const imageFiles = entries.filter((f) => isLocalImageFile(f));
  let best: { file: string; score: number } | null = null;
  for (const file of imageFiles) {
    const fileToken = normalizeStem(path.basename(file, path.extname(file)));
    if (!fileToken) continue;
    const baseWords = baseToken.split(" ").filter((w) => w.length > 1);
    let score = 0;
    for (const word of baseWords) {
      if (fileToken.split(" ").includes(word)) score++;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { file, score };
    }
  }
  if (best) return path.join(dir, best.file);

  return null;
}

/**
 * Find local subtitle files (.srt / .vtt) adjacent to a media file.
 * Returns an array of { path, lang, label }.
 *
 * Language tagging conventions matched:
 *   Movie.en.srt      -> lang "en"
 *   Movie.english.srt -> label "English"
 *   Movie.srt         -> no language
 */
export function findLocalSubtitles(videoFilePath: string): {
  filePath: string;
  lang: string;
  label: string;
}[] {
  const dir = path.dirname(videoFilePath);
  const base = path.basename(videoFilePath, path.extname(videoFilePath));

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }

  const results: { filePath: string; lang: string; label: string }[] = [];

  for (const file of entries) {
    if (!SUBTITLE_FILENAMES.test(file)) continue;
    if (file.toLowerCase().indexOf(base.toLowerCase()) !== 0) continue; // must share video base name

    const stem = path.basename(file, path.extname(file)); // e.g. "Movie.en"
    const remainder = stem.slice(base.length); // e.g. ".en"

    let lang = "";
    let label = "Subtitles";
    if (remainder) {
      const tag = remainder.replace(/^[.\-_]+/, "").toLowerCase();
      if (tag.length > 0) {
        const known = knownLanguages();
        if (known[tag]) {
          lang = tag;
          label = known[tag];
        } else {
          // Long english name like "english"
          const named = knownByLongName(tag);
          if (named) {
            lang = named.code;
            label = named.label;
          }
        }
      }
    }

    results.push({ filePath: path.join(dir, file), lang, label });
  }

  return results;
}

function knownLanguages(): Record<string, string> {
  // ISO 639-1 codes -> English label
  return {
    en: "English",
    fr: "French",
    de: "German",
    es: "Spanish",
    it: "Italian",
    pt: "Portuguese",
    nl: "Dutch",
    pl: "Polish",
    ru: "Russian",
    uk: "Ukrainian",
    tr: "Turkish",
    el: "Greek",
    sv: "Swedish",
    no: "Norwegian",
    da: "Danish",
    fi: "Finnish",
    cs: "Czech",
    hu: "Hungarian",
    ro: "Romanian",
    bg: "Bulgarian",
    hr: "Croatian",
    sr: "Serbian",
    sk: "Slovak",
    sl: "Slovenian",
    he: "Hebrew",
    ar: "Arabic",
    hi: "Hindi",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese",
    th: "Thai",
    vi: "Vietnamese",
    id: "Indonesian",
    ms: "Malay",
    fa: "Persian",
  };
}

function knownByLongName(tag: string): { code: string; label: string } | null {
  const map: Record<string, { code: string; label: string }> = {
    english: { code: "en", label: "English" },
    french: { code: "fr", label: "French" },
    german: { code: "de", label: "German" },
    spanish: { code: "es", label: "Spanish" },
    italian: { code: "it", label: "Italian" },
    portuguese: { code: "pt", label: "Portuguese" },
    dutch: { code: "nl", label: "Dutch" },
    polish: { code: "pl", label: "Polish" },
    russian: { code: "ru", label: "Russian" },
    chinese: { code: "zh", label: "Chinese" },
    japanese: { code: "ja", label: "Japanese" },
    korean: { code: "ko", label: "Korean" },
    arabic: { code: "ar", label: "Arabic" },
    hindi: { code: "hi", label: "Hindi" },
    turkish: { code: "tr", label: "Turkish" },
  };
  return map[tag] || null;
}

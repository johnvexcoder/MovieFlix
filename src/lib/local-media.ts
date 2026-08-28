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
 * Find the best-guess poster image adjacent to a media file.
 * Looks for the movie's base name (e.g. "Movie (2020).jpg") or common
 * filenames (poster.jpg, folder.jpg) in the same directory.
 */
export function findLocalPoster(videoFilePath: string): string | null {
  const dir = path.dirname(videoFilePath);
  const base = path.basename(videoFilePath, path.extname(videoFilePath));

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }

  // 1. Poster matching the video's base name
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

  return null;
}

/**
 * Find the best-guess backdrop image adjacent to a media file.
 */
export function findLocalBackdrop(videoFilePath: string): string | null {
  const dir = path.dirname(videoFilePath);

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

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
  "yify", "yts", "yts.ag", "yts.am", "yts.mx", "yts.lt", "hd", "10bit", "aac5.1", "5.1", "7.1", "remastered"
];

function cleanFileName(name) {
  let cleaned = name;

  // Extract year
  let year = null;
  // Look for year in parentheses or brackets first, e.g. (2007) or [2007]
  const explicitYearMatch = cleaned.match(/[\[\(]((?:19|20)\d{2})[\]\)]/);
  if (explicitYearMatch) {
    year = parseInt(explicitYearMatch[1]);
    // Cut off everything from the year onwards! This is a very safe bet for movies.
    const yearIndex = cleaned.indexOf(explicitYearMatch[0]);
    cleaned = cleaned.substring(0, yearIndex);
  } else {
    // Look for year preceded by a dot or space
    const looseYearMatch = cleaned.match(/[\s.](19\d{2}|20\d{2})\b/);
    if (looseYearMatch) {
      year = parseInt(looseYearMatch[1]);
      const yearIndex = cleaned.indexOf(looseYearMatch[0]);
      cleaned = cleaned.substring(0, yearIndex);
    }
  }

  // Remove anything in brackets or parentheses that is left
  cleaned = cleaned.replace(/\[.*?\]/g, " ");
  cleaned = cleaned.replace(/\(.*?\)/g, " ");

  // Replace dots and underscores with spaces
  cleaned = cleaned.replace(/[._]/g, " ");

  // Remove garbage words
  for (const tag of QUALITY_TAGS) {
    const regex = new RegExp(`\\b${tag.replace(/\./g, "\\.")}\\b`, "ig");
    cleaned = cleaned.replace(regex, " ");
  }

  // Remove extra dashes
  cleaned = cleaned.replace(/[\-–—]/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return { title: cleaned, year };
}

console.log(cleanFileName("Transformers (2007) [REPACK] [1080p] [BluRay] [5.1] [YTS.MX]"));
console.log(cleanFileName("Unstoppable-1080P_HD"));
console.log(cleanFileName("Fear Street Part Two 1978 (2021) [1080p] [WEBRip] [5.1] [YTS.MX]"));
console.log(cleanFileName("The.Forever.Purge.2021.1080p.WEBRip.x264.AAC5.1-[YTS.MX]"));
console.log(cleanFileName("City.Hunter.2024.1080p.WEBRip.x264.AAC5.1-[YTS.MX]"));
console.log(cleanFileName("6.Underground.2019.1080p.WEBRip.x264-[YTS.LT]"));
console.log(cleanFileName("Blade Runner 2049 (2017)"));

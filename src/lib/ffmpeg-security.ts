/**
 * Guards against ffmpeg argument/protocol injection (see SECURITY_AUDIT H3).
 *
 * ffmpeg parses its CLI arguments; a path that starts with "-" would be
 * interpreted as an option (e.g. `-i`, `-f`, `http://...`), and a protocol
 * prefix like `http://` or `concat:` can make ffmpeg open remote/compound
 * inputs, enabling SSRF or reading arbitrary files. Media paths stored in the
 * DB come from the admin-driven scanner, but a malicious filename (or tampered
 * DB records) could otherwise smuggle such strings in.
 */

export function isSafeFfmpegInput(filePath: string): boolean {
  if (!filePath || typeof filePath !== "string") return false;
  if (filePath.length === 0) return false;

  // A leading dash would be parsed as an ffmpeg option rather than an input.
  if (filePath.startsWith("-")) return false;

  // Reject URI/protocol schemes (ffmpeg treats e.g. "http://", "concat:",
  // "rtsp://" as protocol inputs). Also reject Windows "C:" style prefixes.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(filePath)) return false;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(filePath)) return false;

  return true;
}

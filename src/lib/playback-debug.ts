/**
 * Playback diagnosis helpers.
 *
 * These produce a stable classification of why a stream failed so the player
 * and support logs can distinguish codec, network, manifest, segment, buffer
 * and authorization problems without exposing any details in the UI.
 */

export type PlaybackEngine = "native" | "hls.js" | "v2-hls" | "transcode-hls" | "unknown";

export type PlaybackDiagnosticKind =
  | "SOURCE_UNSUPPORTED"
  | "MEDIA_DECODE_ERROR"
  | "MEDIA_NETWORK_ERROR"
  | "ABORTED"
  | "MANIFEST_LOAD_ERROR"
  | "SEGMENT_LOAD_ERROR"
  | "BUFFER_APPEND_ERROR"
  | "BUFFER_STALLED"
  | "HLS_NETWORK_ERROR"
  | "HLS_MEDIA_ERROR"
  | "HLS_FATAL_ERROR"
  | "AUTHORIZATION_FAILED"
  | "UNKNOWN";

export interface PlaybackDiagnostic {
  kind: PlaybackDiagnosticKind;
  engine: PlaybackEngine;
  code: number | null;
  detail: string;
  url: string;
  position: number;
  readyState: number;
  networkState: number;
  activeQuality: unknown;
}

function mediaErrorToKind(code: number): PlaybackDiagnosticKind {
  switch (code) {
    case 1: return "ABORTED";
    case 2: return "MEDIA_NETWORK_ERROR";
    case 3: return "MEDIA_DECODE_ERROR";
    case 4: return "SOURCE_UNSUPPORTED";
    default: return "UNKNOWN";
  }
}

/**
 * Classify a native HTMLMediaElement failure.
 */
export function classifyNativeError(
  video: HTMLVideoElement,
  activeQuality: unknown,
): PlaybackDiagnostic {
  const error = video.error;
  const kind = error ? mediaErrorToKind(error.code) : "UNKNOWN";
  return {
    kind,
    engine: "native",
    code: error ? error.code : null,
    detail: error ? (error.message || "") : "",
    url: video.currentSrc || "",
    position: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    readyState: video.readyState,
    networkState: video.networkState,
    activeQuality,
  };
}

export interface HlsErrorShape {
  type?: string;
  details?: string;
  fatal?: boolean;
  response?: { code?: number } | null;
}

/**
 * Classify an hls.js `Hls.Events.ERROR` payload.
 */
export function classifyHlsError(error: HlsErrorShape, engine: PlaybackEngine): PlaybackDiagnostic {
  const type = error.type || "";
  const details = error.details || "";
  const responseCode = error.response?.code;
  let kind: PlaybackDiagnosticKind;

  if (type === "networkError" && details === "manifestLoadError") kind = "MANIFEST_LOAD_ERROR";
  else if (type === "networkError" && details === "fragLoadError") kind = "SEGMENT_LOAD_ERROR";
  else if (type === "networkError") kind = "HLS_NETWORK_ERROR";
  else if (type === "mediaError" && details === "bufferAppendError") kind = "BUFFER_APPEND_ERROR";
  else if (type === "mediaError" && details === "bufferStalledError") kind = "BUFFER_STALLED";
  else if (type === "mediaError") kind = "HLS_MEDIA_ERROR";
  else if (type === "otherError") kind = "HLS_FATAL_ERROR";
  else kind = "UNKNOWN";

  const detail = [details, responseCode ? `status=${responseCode}` : ""].filter(Boolean).join(" ");
  return {
    kind, engine, code: responseCode ?? null, detail,
    url: "", position: 0, readyState: 0, networkState: 0, activeQuality: null,
  };
}

export function diagnosticSummary(d: PlaybackDiagnostic): string {
  return `[playback:${d.kind}] engine=${d.engine} code=${d.code} detail=${d.detail || "-"} url=${d.url || "-"} pos=${d.position.toFixed(1)} ready=${d.readyState} net=${d.networkState} quality=${String(d.activeQuality)}`;
}

/**
 * Write diagnostics to the console only in explicit debug contexts. The
 * classification is still produced unconditionally so support tooling can
 * consume it, but normal production viewing stays quiet.
 */
export function reportDiagnostic(d: PlaybackDiagnostic): void {
  const explicitDebug = typeof window !== "undefined" &&
    Boolean((window as unknown as { __mfxDebug?: boolean }).__mfxDebug);
  // Quiet in production unless debug is explicitly enabled; structured and
  // always-on in development so failures are greppable as `[MovieFlix Playback]`.
  if (process.env.NODE_ENV === "production" && !explicitDebug) return;
  // eslint-disable-next-line no-console
  console.warn("[MovieFlix Playback]", diagnosticSummary(d));
}

/** Surface the last failure so on-page tooling can read it without any UI. */
export function stashDiagnostic(d: PlaybackDiagnostic): void {
  try {
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__mfxLastDiag = d;
    }
  } catch {
    // diagnostics are never fatal
  }
}
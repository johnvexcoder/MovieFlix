"use client";

/**
 * Smart TV / set-top browser detection.
 *
 * The platform supports two UIs: the standard desktop/mobile experience and a
 * 10-foot TV experience. This module identifies TV-class web browsers (Tizen,
 * webOS, Android TV, Fire TV, Roku, VIDAA, PlayStation, Xbox, etc.) so
 * components can opt into TV-specific layouts and D-pad navigation without
 * touching the desktop/mobile experience.
 *
 * Detection is purely heuristic and COARSE — browsers spoof user agents — so
 * it is never used for authorization, only for presentation tuning. Users can
 * also force the mode with `?tv=1` or `?tv=0`.
 */

const TV_PATTERNS: Array<{ platform: string; pattern: RegExp }> = [
  { platform: "tizen", pattern: /Tizen/i },
  { platform: "webos", pattern: /Web0S|WebOS|LG Browser|NetCast/i },
  { platform: "android-tv", pattern: /Android TV|AndroidTV/i },
  { platform: "fire-tv", pattern: /AFT[A-Z0-9]+|Fire TV/i },
  { platform: "samsung", pattern: /SMART-TV|SmartTV|Smart TV|Maple/i },
  { platform: "vidaa", pattern: /VIDAA/i },
  { platform: "roku", pattern: /Roku/i },
  { platform: "apple-tv", pattern: /AppleTV|tvOS/i },
  { platform: "playstation", pattern: /PLAYSTATION 3|PLAYSTATION 4|PLAYSTATION 5|PS4|PS5/i },
  { platform: "xbox", pattern: /Xbox/i },
  { platform: "opera-tv", pattern: /Opera TV|OperaDTV/i },
  { platform: "smarttv-generic", pattern: /HbbTV/i },
];

export type TvPlatform =
  | "tizen"
  | "webos"
  | "android-tv"
  | "fire-tv"
  | "samsung"
  | "vidaa"
  | "roku"
  | "apple-tv"
  | "playstation"
  | "xbox"
  | "opera-tv"
  | "smarttv-generic"
  | null;

/** Returns the detected TV platform for a raw user-agent string, or null. */
export function detectTvPlatform(userAgent: string): TvPlatform {
  if (!userAgent) return null;
  for (const { platform, pattern } of TV_PATTERNS) {
    if (pattern.test(userAgent)) {
      return platform as TvPlatform;
    }
  }
  // A desktop browser is by far the most common non-TV case; if we reached this
  // point the agent was not recognised as any TV family.
  return null;
}

export function isTvUserAgent(userAgent: string): boolean {
  return detectTvPlatform(userAgent) !== null;
}

/** True when the current page is running inside a TV-class browser. */
export function isTvBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return isTvUserAgent(navigator.userAgent || "");
}

export function getTvPlatform(): TvPlatform {
  if (typeof navigator === "undefined") return null;
  return detectTvPlatform(navigator.userAgent || "");
}

/**
 * Resolve the effective TV mode for the current page, honouring a manual
 * override first (`?tv=1` / `?tv=0`) and falling back to UA detection.
 */
export function resolveTvMode(): boolean {
  if (typeof window === "undefined") return false;
  const override = new URLSearchParams(window.location.search).get("tv");
  if (override === "1") return true;
  if (override === "0") return false;
  return isTvBrowser();
}
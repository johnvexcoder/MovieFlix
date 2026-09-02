import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Reads a single admin setting (stored as TEXT key/value).
 * Returns `fallback` when unset or not parseable.
 */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const [row] = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);
    if (!row || row.value == null || row.value === "") return fallback;
    return row.value as unknown as T;
  } catch {
    return fallback;
  }
}

/**
 * Resolves the public base URL used to build links inside emails.
 *
 * Precedence:
 *   1. Admin-configured `app_public_url` setting (Admin Panel -> Settings)
 *   2. `APP_PUBLIC_URL` environment variable
 *   3. A safe localhost fallback
 *
 * The trailing slash is stripped so callers can safely append `/login` etc.
 */
export async function getAppPublicUrl(): Promise<string> {
  const stored = await getSetting<string>("app_public_url", "");
  const candidate = stored?.trim() || process.env.APP_PUBLIC_URL?.trim() || "http://localhost:9000";
  return candidate.replace(/\/+$/, "");
}

export async function getMaxSessions(): Promise<number> {
  const raw = await getSetting<string>("max_sessions", "3");
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, 20) : 3;
}

export async function getSessionIdleTimeoutSeconds(): Promise<number> {
  const raw = await getSetting<string>("session_timeout", "30");
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed * 60 : 30 * 60;
}

/**
 * Gets the persistent device id for this browser from the cookie, or null so
 * the caller can mint + set one.
 */
export function getDeviceId(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/(?:^|;\s*)device_id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
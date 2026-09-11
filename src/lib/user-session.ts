import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { accounts, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  generateAccessToken,
  generateRefreshToken,
  extractIpSubnet,
  getClientIp,
} from "@/lib/auth";
import {
  getTokenVersion,
  setActiveSession,
  removeSessionsByDevice,
  getAccountActiveSessions,
} from "@/lib/redis";
import { getDeviceId, getMaxSessions, getSessionIdleTimeoutSeconds } from "@/lib/app-settings";

export type AccountRow = typeof accounts.$inferSelect;
export type ProfileRow = typeof profiles.$inferSelect;

export interface EstablishedAccountSession {
  ok: true;
  accountId: string;
  accountUsername: string;
  mainProfile: ProfileRow;
  accountProfiles: ProfileRow[];
  sessionId: string;
  deviceId: string;
  ip: string;
  accessToken: string;
  refreshToken: string;
  isHttps: boolean;
}

export type EstablishAccountSessionResult =
  | EstablishedAccountSession
  | { ok: false; reason: "no_profiles" | "max_sessions"; maxSessions?: number };

/**
 * Establish a full account session: register the active session, enforce the
 * per-device replacement + account session cap, and mint the access/refresh
 * tokens.
 *
 * Shared by the username/password login and the Smart TV QR "claim" flow so
 * both honour identical session semantics. The caller writes the
 * access_token / refresh_token / device_id cookies onto its own response.
 */
export async function establishAccountSession(
  request: NextRequest,
  account: AccountRow,
  accountProfiles: ProfileRow[]
): Promise<EstablishAccountSessionResult> {
  const mainProfile = accountProfiles.find((p) => p.isMainProfile) || accountProfiles[0];
  if (!mainProfile) return { ok: false, reason: "no_profiles" };

  const ip = getClientIp(request);
  const maxSessions = await getMaxSessions();
  const idleTimeout = await getSessionIdleTimeoutSeconds();
  const isHttps =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https";

  let deviceId = getDeviceId(request);
  if (!deviceId) deviceId = uuidv4();

  const sessionId = uuidv4();
  const sessionMeta = {
    deviceId,
    ip,
    userAgent: request.headers.get("user-agent") || "",
  };

  const profileIds = accountProfiles.map((p) => p.id);

  // This device replaces its own previous sessions (profile switching /
  // re-login must not double-count against the account cap).
  await removeSessionsByDevice(profileIds, deviceId, sessionId);

  const accountSessions = await getAccountActiveSessions(profileIds);
  // Only enforce the cap if Redis is reachable (accountSessions is always an
  // array here; null entries were skipped) — we can't count otherwise.
  if (accountSessions.length >= maxSessions) {
    return { ok: false, reason: "max_sessions", maxSessions };
  }

  // Register an initial session on the main profile. If the user picks a
  // different profile afterwards, profile-login replaces this session for the
  // same device.
  await setActiveSession(mainProfile.id, sessionId, sessionMeta, idleTimeout);

  const accessToken = generateAccessToken({
    profileId: mainProfile.id,
    accountId: account.id,
    isAdmin: false,
    fingerprint: extractIpSubnet(ip),
    sessionId,
  });

  // Remember the last client IP + login time so admins can see where an
  // account is connecting from (works through Tailscale/reverse proxies via
  // X-Forwarded-For).
  await db
    .update(accounts)
    .set({ lastIp: ip, lastLoginAt: new Date().toISOString() })
    .where(eq(accounts.id, account.id));

  // Use the current token version so a subsequent logout/revocation correctly
  // invalidates this refresh token (the old hard-coded value of 1 broke this).
  const tokenVersion = await getTokenVersion(mainProfile.id);
  const refreshToken = generateRefreshToken(mainProfile.id, tokenVersion, sessionId);

  return {
    ok: true,
    accountId: account.id,
    accountUsername: account.username,
    mainProfile,
    accountProfiles,
    sessionId,
    deviceId,
    ip,
    accessToken,
    refreshToken,
    isHttps,
  };
}
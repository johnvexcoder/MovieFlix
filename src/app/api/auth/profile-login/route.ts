import { NextRequest } from "next/server";
import { db } from "@/db";
import { profiles, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { comparePin, generateAccessToken, generateRefreshToken, extractIpSubnet, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse, ERROR_CODES } from "@/lib/api-response";
import {
  setRateLimit,
  getTokenVersion,
  setActiveSession,
  getActiveSessions,
  getAccountActiveSessions,
  removeSessionsByDevice,
  getPinFailures,
  recordPinFailure,
  clearPinFailures,
} from "@/lib/redis";
import { getDeviceId, getMaxSessions, getSessionIdleTimeoutSeconds } from "@/lib/app-settings";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);

    // Soft per-IP cap ONLY: a shared egress IP (e.g. Tailscale) must never
    // lock a legitimate user out, so this is high enough to be effectively
    // unlimited for humans while still dampening runaway automation from one
    // IP. Real brute-force protection for PINs happens per-profile (below).
    const softIpLimit = await setRateLimit(`ratelimit:login:${ip}`, 15 * 60 * 1000, 60);
    if (!softIpLimit.allowed) {
      return errorResponse("Too many login attempts. Please try again later.", 429, ERROR_CODES.RATE_LIMITED);
    }

    const body = await request.json();
    const { profileId, pin } = body;

    if (!profileId) {
      return errorResponse("Profile ID is required", 400);
    }

    // Find profile
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId))
      .limit(1);

    if (!profile) {
      return errorResponse("Profile not found", 404);
    }

    // Get account
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, profile.accountId))
      .limit(1);

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    // Check if account is locked
    if (account.isLocked) {
      return errorResponse("This account has been locked. Please contact support.", 403);
    }

    // Check if account is expired
    if (account.expiresAt) {
      const expiresAt = new Date(account.expiresAt);
      if (expiresAt < new Date()) {
        return errorResponse("Account has expired", 403);
      }
    }

    // Check if profile has PIN
    if (profile.pinHash) {
      if (!pin) {
        return errorResponse("PIN is required", 400, ERROR_CODES.PIN_REQUIRED);
      }

      // Generous per-profile cap (100 tries / 15 min) against runaway
      // guessing; a human retyping a PIN will never hit it.
      const profilePinCap = await setRateLimit(`ratelimit:pin:${profile.id}`, 15 * 60 * 1000, 100);
      if (!profilePinCap.allowed) {
        const response = errorResponse("Too many PIN attempts. Please try again later.", 429, ERROR_CODES.PIN_LOCKOUT);
        response.headers.set("Retry-After", "900");
        return response;
      }

      // Escalating cooldown after consecutive failures, keyed to THIS profile
      // only. Other profiles and shared IPs are never affected, and a correct
      // PIN resets the counter below.
      const failures = await getPinFailures(profile.id);
      if (failures && failures.lockUntil && Date.now() < failures.lockUntil) {
        const retryAfter = Math.max(1, Math.ceil((failures.lockUntil - Date.now()) / 1000));
        const response = errorResponse("Too many incorrect PIN attempts. Try again shortly.", 429, ERROR_CODES.PIN_LOCKOUT);
        response.headers.set("Retry-After", String(retryAfter));
        return response;
      }

      const isValid = await comparePin(pin, profile.pinHash);
      if (!isValid) {
        const lockUntil = await recordPinFailure(profile.id);
        const response = errorResponse(
          lockUntil && lockUntil > Date.now()
            ? "Too many incorrect PIN attempts. Try again shortly."
            : "Incorrect PIN code",
          401,
          ERROR_CODES.PIN_INVALID
        );
        if (lockUntil && lockUntil > Date.now()) {
          response.headers.set("Retry-After", String(Math.ceil((lockUntil - Date.now()) / 1000)));
        }
        return response;
      }
      await clearPinFailures(profile.id);
    }

    const maxSessions = await getMaxSessions();
    const idleTimeout = await getSessionIdleTimeoutSeconds();

    // All profiles belonging to this account (needed for account-wide count).
    const accountProfiles = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.accountId, account.id));
    const accountProfileIds = accountProfiles.map((p) => p.id);

    // Device identity: the same browser/device re-logs in by REPLACING its own
    // earlier sessions rather than stacking them up (handles profile switching
    // and re-login on one device without burning extra session slots).
    let deviceId = getDeviceId(request);
    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    if (!deviceId) {
      deviceId = uuidv4();
    }

    const sessionId = uuidv4();
    const sessionMeta = {
      deviceId,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") || "",
    };

    // 1. This device's own stale sessions are superseded by this login.
    await removeSessionsByDevice(accountProfileIds, deviceId, sessionId);

    // 2. One active session per profile. If ANOTHER device is already using
    //    this profile it must NOT be kicked — reject the new login instead.
    const profileSessions = await getActiveSessions(profile.id);
    if (profileSessions && profileSessions.length > 0) {
      const other = profileSessions.find((s) => s.sessionId !== sessionId);
      if (other) {
        return errorResponse(
          "This profile is already in use on another device. Please choose another profile, or end that session from the other device before continuing.",
          409,
          ERROR_CODES.PROFILE_IN_USE
        );
      }
    }

    // 3. Account-wide session cap (Session Security setting). Count sessions
    //    across ALL profiles after this device's sessions were replaced.
    if (profileSessions !== null) {
      const accountSessions = await getAccountActiveSessions(accountProfileIds);
      if (accountSessions.length >= maxSessions) {
        return errorResponse(
          `Your account has reached the maximum of ${maxSessions} active sessions. End a session on another device, or contact support to raise the limit.`,
          429,
          ERROR_CODES.ACCOUNT_SESSION_LIMIT
        );
      }
    }

    // Register the new active session for this profile.
    await setActiveSession(profile.id, sessionId, sessionMeta, idleTimeout);

    const accessToken = generateAccessToken({
      profileId: profile.id,
      accountId: account.id,
      isAdmin: false,
      fingerprint: extractIpSubnet(ip),
      sessionId,
    });

    const tokenVersion = await getTokenVersion(profile.id);
    const refreshToken = generateRefreshToken(profile.id, tokenVersion, sessionId);

    const response = successResponse({
      profile: {
        id: profile.id,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        isMainProfile: profile.isMainProfile,
      },
      account: {
        id: account.id,
        username: account.username,
        expiresAt: account.expiresAt,
      },
      accessToken,
    });

    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    response.cookies.set("device_id", deviceId, {
      httpOnly: false,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Profile login error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal server error", 500);
  }
}
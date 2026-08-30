import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { accounts, profiles } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { comparePassword, generateAccessToken, generateRefreshToken, extractIpSubnet, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import {
  setRateLimit,
  getTokenVersion,
  setActiveSession,
  removeSessionsByDevice,
  getAccountActiveSessions,
} from "@/lib/redis";
import { getDeviceId, getMaxSessions, getSessionIdleTimeoutSeconds } from "@/lib/app-settings";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return errorResponse("Username and password are required", 400);
    }

    const ip = getClientIp(request);

    // Rate limit: 5 login attempts per 15 minutes per IP + username. Keying on
    // the pair (rather than IP alone) keeps a single compromised/misconfigured
    // proxy from trivially defeating the limit via spoofed X-Forwarded-For.
    const rateKey = `ratelimit:account-login:${ip}:${String(username).toLowerCase()}`;
    const rateLimit = await setRateLimit(rateKey, 15 * 60 * 1000, 5);
    if (!rateLimit.allowed) {
      return errorResponse("Too many login attempts. Please try again later.", 429);
    }

    // Find account by username or email
    const [account] = await db
      .select()
      .from(accounts)
      .where(
        or(
          eq(accounts.username, username),
          eq(accounts.email, username)
        )
      )
      .limit(1);

    if (!account) {
      return errorResponse("Invalid username or password", 401);
    }

    // Check if account is locked
    if (account.isLocked) {
      return errorResponse("This account has been locked. Please contact support.", 403);
    }

    // Verify password
    const isValid = await comparePassword(password, account.passwordHash);
    if (!isValid) {
      return errorResponse("Invalid username or password", 401);
    }

    // Check if account is expired
    if (account.expiresAt) {
      const expiresAt = new Date(account.expiresAt);
      if (expiresAt < new Date()) {
        return errorResponse("Account has expired", 403);
      }
    }

    // Get profiles for this account
    const accountProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.accountId, account.id));

    const mainProfile = accountProfiles.find((p) => p.isMainProfile) || accountProfiles[0];

    if (!mainProfile) {
      return errorResponse("No profiles found for this account", 404);
    }

    // Session enforcement for the account.
    const maxSessions = await getMaxSessions();
    const idleTimeout = await getSessionIdleTimeoutSeconds();
    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

    let deviceId = getDeviceId(request);
    if (!deviceId) deviceId = uuidv4();

    const sessionId = uuidv4();
    const sessionMeta = {
      deviceId,
      ip: getClientIp(request),
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
      return errorResponse(
        `Your account has reached the maximum of ${maxSessions} active sessions. End a session on another device, or contact support to raise the limit.`,
        429
      );
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

    // Use the current token version so a subsequent logout/revocation correctly
    // invalidates this refresh token (the old hard-coded value of 1 broke this).
    const tokenVersion = await getTokenVersion(mainProfile.id);
    const refreshToken = generateRefreshToken(mainProfile.id, tokenVersion, sessionId);

    const response = successResponse({
      account: {
        id: account.id,
        username: account.username,
        expiresAt: account.expiresAt,
        mustChangePassword: Boolean(account.mustChangePassword),
      },
      profiles: accountProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        isMainProfile: p.isMainProfile,
      })),
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
    console.error("Account login error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal server error", 500);
  }
}
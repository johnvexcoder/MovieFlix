import { NextRequest } from "next/server";
import { db } from "@/db";
import { profiles, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRefreshToken, generateAccessToken, extractIpSubnet, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse, ERROR_CODES } from "@/lib/api-response";
import { getTokenVersion, setRateLimit, getActiveSessions, touchActiveSession } from "@/lib/redis";
import { getSessionIdleTimeoutSeconds } from "@/lib/app-settings";
import type { JWTPayload } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (!refreshToken) {
      return errorResponse("Refresh token required", 401);
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      return errorResponse("Invalid refresh token", 401, ERROR_CODES.AUTHENTICATION_EXPIRED);
    }

    // Per-session cap (NOT per-IP): a browser/device refreshes only a few
    // times per minute during normal use, and keying by sessionId means a
    // shared egress IP (Tailscale) can never cause false lockouts across
    // devices. The token is verified first so unauthenticated callers cannot
    // burn another session's budget.
    const sessionKey = payload.sessionId || payload.profileId;
    const rateLimit = await setRateLimit(`ratelimit:refresh:${sessionKey}`, 60 * 1000, 20);
    if (!rateLimit.allowed) {
      return errorResponse("Too many requests. Please try again later.", 429, ERROR_CODES.RATE_LIMITED);
    }

    const currentVersion = await getTokenVersion(payload.profileId);
    if (payload.tokenVersion !== currentVersion) {
      return errorResponse("Token revoked", 401, ERROR_CODES.AUTHENTICATION_EXPIRED);
    }

    const ip = getClientIp(request);

    // Find profile
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, payload.profileId))
      .limit(1);

    if (!profile) {
      return errorResponse("Profile not found", 404);
    }

    // Find account
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
      return errorResponse("Account has been locked", 403);
    }

    // Check account expiry
    if (account.expiresAt) {
      const expiresAt = new Date(account.expiresAt);
      if (expiresAt < new Date()) {
        return errorResponse("Account has expired", 403);
      }
    }

    const tokenPayload: Omit<JWTPayload, "tokenVersion"> = {
      profileId: profile.id,
      accountId: account.id,
      isAdmin: false,
      fingerprint: extractIpSubnet(ip),
      sessionId: payload.sessionId,
    };

    // Keep the session alive and re-issue an access token that still carries the
    // sessionId so the middleware session check keeps working after refresh.
    const idleTimeout = await getSessionIdleTimeoutSeconds();
    if (payload.sessionId) {
      const sessions = await getActiveSessions(profile.id);
      if (sessions && !sessions.some((s) => s.sessionId === payload.sessionId)) {
        return errorResponse("Session expired", 401, ERROR_CODES.AUTHENTICATION_EXPIRED);
      }
      await touchActiveSession(profile.id, payload.sessionId, idleTimeout);
    }

    const newAccessToken = generateAccessToken(tokenPayload);

    const response = successResponse({
      accessToken: newAccessToken,
    });

    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

    response.cookies.set("access_token", newAccessToken, {
      httpOnly: true,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Refresh error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal server error", 500);
  }
}

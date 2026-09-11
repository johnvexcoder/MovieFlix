import { NextRequest } from "next/server";
import { db } from "@/db";
import { accounts, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse, ERROR_CODES } from "@/lib/api-response";
import { claimTvQrChallenge, TV_CODE_RE } from "@/lib/tv-auth";
import { establishAccountSession } from "@/lib/user-session";

export const dynamic = "force-dynamic";

/**
 * Complete the TV login. The TV exchanges the code + one-time claim token for
 * a real account session; the response sets the access/refresh/device cookies
 * so the TV is signed in exactly like a desktop login.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || "").toUpperCase();
    const claimToken = String(body.claimToken || "");

    if (!TV_CODE_RE.test(code) || !claimToken) {
      return errorResponse("Invalid TV login code", 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const claimed = await claimTvQrChallenge(code, claimToken);
    if (!claimed.ok) {
      return errorResponse(
        "This TV login code has expired or was already used. Please generate a new one.",
        400,
        ERROR_CODES.NOT_FOUND
      );
    }

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, claimed.accountId))
      .limit(1);

    if (!account) {
      return errorResponse("Account not found", 404, ERROR_CODES.NOT_FOUND);
    }

    if (account.isLocked) {
      return errorResponse("This account has been locked. Please contact support.", 403);
    }

    if (account.expiresAt) {
      const expiresAt = new Date(account.expiresAt);
      if (expiresAt < new Date()) {
        return errorResponse("Account has expired", 403);
      }
    }

    const accountProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.accountId, account.id));

    const established = await establishAccountSession(request, account, accountProfiles);
    if (!established.ok) {
      if (established.reason === "max_sessions") {
        return errorResponse(
          `Your account has reached the maximum of ${established.maxSessions} active sessions. End a session on another device, or contact support to raise the limit.`,
          429,
          ERROR_CODES.ACCOUNT_SESSION_LIMIT
        );
      }
      return errorResponse("No profiles found for this account", 404, ERROR_CODES.NOT_FOUND);
    }

    const { accessToken, refreshToken, deviceId, isHttps } = established;

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
    console.error("TV QR claim error:", error);
    return errorResponse("Could not complete TV login", 500);
  }
}
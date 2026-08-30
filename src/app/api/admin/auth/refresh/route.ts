import { NextRequest } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRefreshToken, generateAccessToken } from "@/lib/auth";
import { successResponse, errorResponse, ERROR_CODES } from "@/lib/api-response";
import { getTokenVersion, setRateLimit } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("admin_session")?.value;

    if (!sessionToken) {
      return errorResponse("Admin session required", 401);
    }

    const payload = await verifyRefreshToken(sessionToken);
    if (!payload) {
      return errorResponse("Invalid admin session", 401, ERROR_CODES.AUTHENTICATION_EXPIRED);
    }

    // Per-session cap (NOT per-IP), checked after the token is verified so a
    // shared egress IP can never lock the admin out via other traffic.
    const sessionKey = payload.sessionId || payload.profileId;
    const rateLimit = await setRateLimit(`ratelimit:admin_refresh:${sessionKey}`, 60 * 1000, 20);
    if (!rateLimit.allowed) {
      return errorResponse("Too many requests. Please try again later.", 429, ERROR_CODES.RATE_LIMITED);
    }

    const currentVersion = await getTokenVersion(payload.profileId);
    if (payload.tokenVersion !== currentVersion) {
      return errorResponse("Token revoked", 401, ERROR_CODES.AUTHENTICATION_EXPIRED);
    }

    // Find admin
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, payload.profileId))
      .limit(1);

    if (!admin) {
      return errorResponse("Admin not found", 404);
    }

    const newAccessToken = generateAccessToken({
      profileId: admin.id,
      accountId: "admin",
      isAdmin: true,
      fingerprint: "admin",
    });

    const response = successResponse({
      admin: {
        id: admin.id,
        username: admin.username,
      },
      accessToken: newAccessToken,
    });

    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

    response.cookies.set("admin_token", newAccessToken, {
      httpOnly: true,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin refresh error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal server error", 500);
  }
}

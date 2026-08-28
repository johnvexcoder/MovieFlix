import { NextRequest } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRefreshToken, generateAccessToken, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getTokenVersion, setRateLimit } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("admin_session")?.value;

    if (!sessionToken) {
      return errorResponse("Admin session required", 401);
    }

    const ip = getClientIp(request);
    
    // Rate limit: 5 refresh attempts per 1 minute per IP
    const rateLimit = await setRateLimit(`ratelimit:admin_refresh:${ip}`, 60 * 1000, 5);
    if (!rateLimit.allowed) {
      return errorResponse("Too many requests. Please try again later.", 429);
    }

    const payload = await verifyRefreshToken(sessionToken);
    if (!payload) {
      return errorResponse("Invalid admin session", 401);
    }

    const currentVersion = await getTokenVersion(payload.profileId);
    if (payload.tokenVersion !== currentVersion) {
      return errorResponse("Token revoked", 401);
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

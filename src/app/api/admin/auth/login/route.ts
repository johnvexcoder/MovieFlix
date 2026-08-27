import { NextRequest } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { comparePassword, generateAccessToken, generateRefreshToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return errorResponse("Username and password are required", 400);
    }

    // Find admin
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.username, username))
      .limit(1);

    if (!admin) {
      return errorResponse("Invalid admin username or password", 401);
    }

    // Verify password
    const isValid = await comparePassword(password, admin.passwordHash);
    if (!isValid) {
      return errorResponse("Invalid admin username or password", 401);
    }

    // Generate admin token
    const accessToken = generateAccessToken({
      profileId: admin.id,
      accountId: "admin",
      isAdmin: true,
      fingerprint: "admin",
    });

    // Long-lived session refresh token (7 days)
    const sessionToken = generateRefreshToken(admin.id, 1);

    // Build response
    const response = successResponse({
      admin: {
        id: admin.id,
        username: admin.username,
      },
      accessToken,
    });

    // Set cookies (secure only if connection is HTTPS)
    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

    response.cookies.set("admin_token", accessToken, {
      httpOnly: true,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    response.cookies.set("admin_session", sessionToken, {
      httpOnly: true,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal server error", 500);
  }
}

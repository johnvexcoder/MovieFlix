import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRefreshToken, generateAccessToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get("admin_session")?.value;

    if (!sessionToken) {
      return errorResponse("Admin session required", 401);
    }

    const payload = await verifyRefreshToken(sessionToken);
    if (!payload) {
      return errorResponse("Invalid admin session", 401);
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

    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set("admin_token", newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin refresh error:", error);
    return errorResponse("Internal server error", 500);
  }
}
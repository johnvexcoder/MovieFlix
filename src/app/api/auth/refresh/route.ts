import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRefreshToken, generateAccessToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import type { JWTPayload } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get("refresh_token")?.value;

    if (!refreshToken) {
      return errorResponse("Refresh token required", 401);
    }

    const payload = await verifyRefreshToken(refreshToken);
    if (!payload) {
      return errorResponse("Invalid refresh token", 401);
    }

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

    // Check account expiry
    if (account.expiresAt) {
      const expiresAt = new Date(account.expiresAt);
      if (expiresAt < new Date()) {
        return errorResponse("Account has expired", 403);
      }
    }

    // Get client info
    const ip = request.headers.get("x-forwarded-for") || "0.0.0.0";
    const subnet = ip.split(".").slice(0, 3).join(".");

    // Generate new access token
    const tokenPayload: Omit<JWTPayload, "tokenVersion"> = {
      profileId: profile.id,
      accountId: account.id,
      isAdmin: false,
      fingerprint: subnet,
    };

    const newAccessToken = generateAccessToken(tokenPayload);

    const response = successResponse({
      accessToken: newAccessToken,
    });

    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set("access_token", newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Refresh error:", error);
    return errorResponse("Internal server error", 500);
  }
}
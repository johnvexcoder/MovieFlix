import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { comparePin, generateAccessToken, generateRefreshToken, extractIpSubnet } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
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
        return errorResponse("PIN is required", 400);
      }

      const isValid = await comparePin(pin, profile.pinHash);
      if (!isValid) {
        return errorResponse("Invalid PIN", 401);
      }
    }

    // Get client info for fingerprint
    const ip = request.headers.get("x-forwarded-for") || "0.0.0.0";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Generate tokens
    const accessToken = generateAccessToken({
      profileId: profile.id,
      accountId: account.id,
      isAdmin: false,
      fingerprint: extractIpSubnet(ip),
    });

    const refreshToken = generateRefreshToken(profile.id, 1);

    // Build response
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

    // Set cookies
    const isProduction = process.env.NODE_ENV === "production";
    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Profile login error:", error);
    return errorResponse("Internal server error", 500);
  }
}

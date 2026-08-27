import { NextRequest } from "next/server";
import { db } from "@/db";
import { profiles, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { comparePin, generateAccessToken, generateRefreshToken, extractIpSubnet } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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
        return errorResponse("Incorrect PIN code", 401);
      }
    }

    const ip = request.headers.get("x-forwarded-for") || "0.0.0.0";

    const accessToken = generateAccessToken({
      profileId: profile.id,
      accountId: account.id,
      isAdmin: false,
      fingerprint: extractIpSubnet(ip),
    });

    const refreshToken = generateRefreshToken(profile.id, 1);

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

    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

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

    return response;
  } catch (error) {
    console.error("Profile login error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal server error", 500);
  }
}

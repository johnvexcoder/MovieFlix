import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, profiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { comparePassword, generateAccessToken, generateRefreshToken, extractIpSubnet } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return errorResponse("Username and password are required", 400);
    }

    // Find account
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.username, username))
      .limit(1);

    if (!account) {
      return errorResponse("Invalid credentials", 401);
    }

    // Verify password
    const isValid = await comparePassword(password, account.passwordHash);
    if (!isValid) {
      return errorResponse("Invalid credentials", 401);
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

    // Get client info for fingerprint
    const ip = request.headers.get("x-forwarded-for") || "0.0.0.0";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Generate tokens for first profile (main profile)
    const mainProfile = accountProfiles.find((p) => p.isMainProfile) || accountProfiles[0];

    if (!mainProfile) {
      return errorResponse("No profiles found for this account", 404);
    }

    const accessToken = generateAccessToken({
      profileId: mainProfile.id,
      accountId: account.id,
      isAdmin: false,
      fingerprint: extractIpSubnet(ip),
    });

    const refreshToken = generateRefreshToken(mainProfile.id, 1);

    // Build response
    const response = successResponse({
      account: {
        id: account.id,
        username: account.username,
        expiresAt: account.expiresAt,
      },
      profiles: accountProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        isMainProfile: p.isMainProfile,
      })),
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
    console.error("Account login error:", error);
    return errorResponse("Internal server error", 500);
  }
}

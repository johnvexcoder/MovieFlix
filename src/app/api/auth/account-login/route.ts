import { NextRequest } from "next/server";
import { db } from "@/db";
import { accounts, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { comparePassword, generateAccessToken, generateRefreshToken, extractIpSubnet } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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
      return errorResponse("Invalid username or password", 401);
    }

    // Verify password
    const isValid = await comparePassword(password, account.passwordHash);
    if (!isValid) {
      return errorResponse("Invalid username or password", 401);
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

    const ip = request.headers.get("x-forwarded-for") || "0.0.0.0";

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
    console.error("Account login error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal server error", 500);
  }
}

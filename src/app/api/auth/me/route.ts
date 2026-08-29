import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;

    if (!accessToken) {
      return errorResponse("Not authenticated", 401);
    }

    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    // Get profile
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, payload.profileId))
      .limit(1);

    if (!profile) {
      return errorResponse("Profile not found", 404);
    }

    // Get account to check expiry
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, profile.accountId))
      .limit(1);

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    // Check if account is locked
    if (account.isLocked) {
      return errorResponse("Account has been locked", 403);
    }

    // Check if account is expired
    if (account.expiresAt) {
      const expiresAt = new Date(account.expiresAt);
      if (expiresAt < new Date()) {
        return errorResponse("Account has expired", 403);
      }
    }

    return successResponse({
      id: profile.id,
      accountId: profile.accountId,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      isMainProfile: profile.isMainProfile,
      accountExpiresAt: account.expiresAt,
      accountCreatedAt: account.createdAt,
      accountUsername: account.username,
      accountEmail: account.email,
      mustChangePassword: Boolean(account.mustChangePassword),
    });
  } catch (error) {
    console.error("Get me error:", error);
    return errorResponse("Internal server error", 500);
  }
}

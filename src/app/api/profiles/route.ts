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

    // Get profiles for this account
    const accountProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.accountId, payload.accountId));

    // Get account
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, payload.accountId))
      .limit(1);

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    return successResponse({
      profiles: accountProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        isMainProfile: p.isMainProfile,
        hasPin: !!p.pinHash,
      })),
      accountExpiresAt: account.expiresAt,
    });
  } catch (error) {
    console.error("Get profiles error:", error);
    return errorResponse("Internal server error", 500);
  }
}
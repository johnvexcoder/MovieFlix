import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, profileSettings, accounts } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { verifyToken, hashPin } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";

const MAX_PROFILES_PER_ACCOUNT = 5;

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    // Get account
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, payload.accountId))
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

    // Get profiles for this account
    const accountProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.accountId, payload.accountId));

    return successResponse({
      profiles: accountProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        isMainProfile: p.isMainProfile,
        hasPin: !!p.pinHash,
      })),
      canCreateMore: accountProfiles.length < MAX_PROFILES_PER_ACCOUNT,
      maxProfiles: MAX_PROFILES_PER_ACCOUNT,
      accountExpiresAt: account.expiresAt,
    });
  } catch (error) {
    console.error("Get account profiles error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    // Get account
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, payload.accountId))
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

    // Check profile count limit
    const [profileCountResult] = await db
      .select({ value: count() })
      .from(profiles)
      .where(eq(profiles.accountId, payload.accountId));

    if (profileCountResult.value >= MAX_PROFILES_PER_ACCOUNT) {
      return errorResponse(`Maximum ${MAX_PROFILES_PER_ACCOUNT} profiles allowed per account`, 400);
    }

    const body = await request.json();
    const { name, pin, avatarUrl } = body;

    if (!name || name.trim().length === 0) {
      return errorResponse("Profile name is required", 400);
    }

    // Create profile
    const profileId = uuidv4();
    const pinHash = pin ? await hashPin(pin) : null;

    await db.insert(profiles).values({
      id: profileId,
      accountId: payload.accountId,
      name: name.trim(),
      pinHash,
      avatarUrl: avatarUrl || null,
      isMainProfile: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create profile settings
    await db.insert(profileSettings).values({
      id: uuidv4(),
      profileId,
      language: "en",
      autoplayNext: true,
      defaultQuality: "auto",
      subtitleEnabled: false,
    });

    return successResponse(
      {
        profile: {
          id: profileId,
          name: name.trim(),
          isMainProfile: false,
          hasPin: !!pinHash,
        },
      },
      201
    );
  } catch (error) {
    console.error("Create profile error:", error);
    return errorResponse("Internal server error", 500);
  }
}

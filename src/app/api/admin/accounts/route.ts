import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, profiles, profileSettings, watchHistory, sessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken, hashPassword } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";

export async function GET(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    // Get all accounts with profile counts
    const allAccounts = await db
      .select({
        id: accounts.id,
        username: accounts.username,
        isTemp: accounts.isTemp,
        durationHours: accounts.durationHours,
        expiresAt: accounts.expiresAt,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .orderBy(desc(accounts.createdAt));

    // Get profile counts for each account
    const accountsWithProfiles = await Promise.all(
      allAccounts.map(async (account) => {
        const accountProfiles = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.accountId, account.id));

        return {
          ...account,
          profileCount: accountProfiles.length,
          isActive: !account.expiresAt || new Date(account.expiresAt) > new Date(),
        };
      })
    );

    return successResponse({
      accounts: accountsWithProfiles,
      total: accountsWithProfiles.length,
    });
  } catch (error) {
    console.error("Get accounts error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const body = await request.json();
    const { username, password, durationHours } = body;

    if (!username || !password) {
      return errorResponse("Username and password are required", 400);
    }

    if (username.length < 3) {
      return errorResponse("Username must be at least 3 characters", 400);
    }

    if (password.length < 6) {
      return errorResponse("Password must be at least 6 characters", 400);
    }

    // Check if username already exists
    const [existing] = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.username, username))
      .limit(1);

    if (existing) {
      return errorResponse("Username already exists", 409);
    }

    // Create account
    const accountId = uuidv4();
    const passwordHash = await hashPassword(password);

    // Calculate expiry if duration provided
    let expiresAt: string | null = null;
    const isTemp = durationHours && durationHours > 0;
    if (isTemp && durationHours) {
      const expiryDate = new Date();
      expiryDate.setHours(expiryDate.getHours() + durationHours);
      expiresAt = expiryDate.toISOString();
    }

    await db.insert(accounts).values({
      id: accountId,
      username,
      passwordHash,
      isTemp: isTemp || false,
      durationHours: durationHours || null,
      expiresAt,
      createdByAdminId: payload.profileId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create default main profile
    const profileId = uuidv4();
    await db.insert(profiles).values({
      id: profileId,
      accountId,
      name: `${username}'s Profile`,
      isMainProfile: true,
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
        account: {
          id: accountId,
          username,
          isTemp: isTemp || false,
          durationHours: durationHours || null,
          expiresAt,
          profileCount: 1,
        },
      },
      201
    );
  } catch (error) {
    console.error("Create account error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("id");

    if (!accountId) {
      return errorResponse("Account ID is required", 400);
    }

    // Get account
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    // Delete all profiles for this account
    const accountProfiles = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(eq(profiles.accountId, accountId));

    for (const profile of accountProfiles) {
      await db.delete(watchHistory).where(eq(watchHistory.profileId, profile.id));
      await db.delete(sessions).where(eq(sessions.profileId, profile.id));
      await db.delete(profileSettings).where(eq(profileSettings.profileId, profile.id));
      await db.delete(profiles).where(eq(profiles.id, profile.id));
    }

    // Delete account
    await db.delete(accounts).where(eq(accounts.id, accountId));

    return successResponse({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    return errorResponse("Internal server error", 500);
  }
}

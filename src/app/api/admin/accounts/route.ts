import { NextRequest } from "next/server";
import { db } from "@/db";
import { accounts, profiles, profileSettings } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken, hashPassword } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";
import { getAppPublicUrl } from "@/lib/app-settings";
import { getActiveSessions, removeActiveSession } from "@/lib/redis";
import { deleteAccountCompletely } from "@/services/delete-account";

async function getActiveSessionsForProfiles(profileIds: string[]) {
  const results: { profileId: string; sessionId: string }[] = [];
  for (const pid of profileIds) {
    try {
      const sessions = await getActiveSessions(pid);
      if (!sessions) continue; // redis unavailable -> fail open
      for (const s of sessions) {
        results.push({ profileId: pid, sessionId: s.sessionId });
      }
    } catch {
      // ignore per-profile redis errors
    }
  }
  return results;
}

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
        email: accounts.email,
        isTemp: accounts.isTemp,
        isLocked: accounts.isLocked,
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
    const { username, email, fullName, password, durationHours } = body;

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

    if (email) {
      const [existingEmail] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.email, email))
        .limit(1);
      
      if (existingEmail) {
        return errorResponse("Email already exists", 409);
      }
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
      email: email || null,
      fullName: fullName || null,
      passwordHash,
      isTemp: isTemp || false,
      // Force the user to set their own password on first login instead of
      // relying on a plaintext credential shared over email.
      mustChangePassword: true,
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
      name: fullName ? fullName : `${username}'s Profile`,
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

    if (email) {
      const baseUrl = await getAppPublicUrl();
      await sendEmail({
        to: email,
        subject: "Welcome to MovieFlix!",
        html: welcomeEmail({ username, fullName, password, baseUrl }),
      });
    }

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

    // Clean up any active Redis sessions for this account's profiles so a
    // deleted account cannot keep watching through a cached session.
    try {
      const accountProfilesBefore = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.accountId, accountId));
      const sessionIds = await getActiveSessionsForProfiles(accountProfilesBefore.map((p) => p.id));
      for (const sid of sessionIds) {
        await removeActiveSession(sid.profileId, sid.sessionId);
      }
    } catch {
      // Redis may be down; the DB cleanup below is the critical part.
    }

    // Delete every dependent row (FK constraints) inside one transaction so the
    // account is never left half-deleted. Shared with the expired-account
    // cleanup service so both paths stay in sync.
    const { deletedProfiles } = await deleteAccountCompletely(accountId);

    return successResponse({ message: "Account deleted successfully", deletedProfiles });
  } catch (error) {
    console.error("Delete account error:", error);
    return errorResponse("Internal server error", 500);
  }
}

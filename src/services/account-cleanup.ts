import { db } from "@/db";
import { accounts, profiles, profileSettings, watchHistory, sessions } from "@/db/schema";
import { lt, inArray, eq } from "drizzle-orm";

export async function cleanupExpiredAccounts(): Promise<{
  deletedAccounts: number;
  deletedProfiles: number;
}> {
  try {
    const now = new Date().toISOString();

    // Find expired accounts
    const expiredAccounts = await db
      .select()
      .from(accounts)
      .where(lt(accounts.expiresAt, now));

    if (expiredAccounts.length === 0) {
      return { deletedAccounts: 0, deletedProfiles: 0 };
    }

    const accountIds = expiredAccounts.map((a) => a.id);

    // Find all profiles for these accounts
    const accountProfiles = await db
      .select()
      .from(profiles)
      .where(inArray(profiles.accountId, accountIds));

    const profileIds = accountProfiles.map((p) => p.id);

    // Delete watch history
    if (profileIds.length > 0) {
      await db
        .delete(watchHistory)
        .where(inArray(watchHistory.profileId, profileIds));
    }

    // Delete sessions
    if (profileIds.length > 0) {
      await db
        .delete(sessions)
        .where(inArray(sessions.profileId, profileIds));
    }

    // Delete profile settings
    if (profileIds.length > 0) {
      await db
        .delete(profileSettings)
        .where(inArray(profileSettings.profileId, profileIds));
    }

    // Delete profiles
    if (profileIds.length > 0) {
      await db.delete(profiles).where(inArray(profiles.id, profileIds));
    }

    // Delete accounts
    await db.delete(accounts).where(inArray(accounts.id, accountIds));

    console.log(
      `🗑️  Cleanup complete: deleted ${expiredAccounts.length} expired accounts, ${accountProfiles.length} profiles`
    );

    return {
      deletedAccounts: expiredAccounts.length,
      deletedProfiles: accountProfiles.length,
    };
  } catch (error) {
    console.error("Cleanup expired accounts error:", error);
    return { deletedAccounts: 0, deletedProfiles: 0 };
  }
}

// Start periodic cleanup every 5 minutes
export function startAccountCleanupService() {
  console.log("🕐 Starting account cleanup service (every 5 minutes)...");

  const interval = setInterval(async () => {
    await cleanupExpiredAccounts();
  }, 5 * 60 * 1000);

  // Clean up on process exit
  process.on("SIGINT", () => clearInterval(interval));
  process.on("SIGTERM", () => clearInterval(interval));

  return interval;
}
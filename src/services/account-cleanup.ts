import { db } from "@/db";
import { accounts, signupSessions } from "@/db/schema";
import { eq, lt, or } from "drizzle-orm";
import { deleteAccountCompletely } from "./delete-account";
import { releaseExpiredReservations } from "./billing/service";

export async function cleanupExpiredAccounts(): Promise<{
  deletedAccounts: number;
  deletedProfiles: number;
}> {
  try {
    const now = new Date().toISOString();

    // Reconcile abandoned QR payments even if PayMongo's expiry webhook was
    // delayed or missed. This also releases any temporarily reserved promo use.
    const expiredPayments = await releaseExpiredReservations();
    if (expiredPayments > 0) console.log(`Expired ${expiredPayments} abandoned payment order(s)`);

    // Find expired accounts
    const expiredAccounts = await db
      .select({ id: accounts.id })
      .from(accounts)
      .leftJoin(signupSessions, eq(signupSessions.accountId, accounts.id))
      .where(or(lt(accounts.expiresAt, now), lt(signupSessions.expiresAt, now)));

    if (expiredAccounts.length === 0) {
      return { deletedAccounts: 0, deletedProfiles: 0 };
    }

    // Delete each account with all of its dependent rows inside one
    // transaction. Reuses the exact same routine as the admin delete endpoint
    // so cleanup never leaves orphaned rows that block the account deletion.
    let deletedProfiles = 0;
    let deletedAccounts = 0;
    for (const account of expiredAccounts) {
      try {
        const result = await deleteAccountCompletely(account.id);
        deletedProfiles += result.deletedProfiles;
        deletedAccounts += 1;
      } catch (e) {
        // Isolate failures so one stuck account never blocks the rest.
        console.error(`Cleanup failed for account ${account.id}:`, e);
      }
    }

    console.log(
      `🗑️  Cleanup complete: deleted ${deletedAccounts} expired accounts, ${deletedProfiles} profiles`
    );

    return {
      deletedAccounts,
      deletedProfiles,
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

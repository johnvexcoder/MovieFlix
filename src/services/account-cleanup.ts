import { db } from "@/db";
import { accounts } from "@/db/schema";
import { and, eq, lt } from "drizzle-orm";
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

    // Account data is preserved by default. Older versions deleted an account
    // when any historical signup session expired, which could erase an active
    // paid customer after a restart. Only explicitly temporary, already-expired
    // trial accounts are eligible, and only when the operator opts in.
    if (process.env.TRIAL_AUTO_DELETE_EXPIRED !== "true") {
      return { deletedAccounts: 0, deletedProfiles: 0 };
    }
    const expiredAccounts = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.isTemp, true), eq(accounts.registrationStatus, "active"), lt(accounts.expiresAt, now)));

    if (expiredAccounts.length === 0) return { deletedAccounts: 0, deletedProfiles: 0 };

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

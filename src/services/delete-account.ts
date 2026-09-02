import { db } from "@/db";
import {
  accounts,
  profiles,
  profileSettings,
  watchHistory,
  sessions,
  adminMessages,
  contactSubmissions,
  paymentSubmissions,
  messageViews,
  passwordResetTokens,
} from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Deletes every row that references an account (directly or through its
 * profiles) so the account row itself can be removed without violating
 * foreign-key constraints. Runs inside a single transaction so the account is
 * never left half-deleted.
 *
 * Used by BOTH the admin delete endpoint and the expired-account cleanup
 * service so the two always agree on what "delete an account" means.
 *
 * NOTE: uses the better-sqlite3 SYNCHRONOUS transaction API — the callback
 * must NOT be async and every statement inside must be `.run()`/.all()/.get()
 * (never awaited), otherwise drizzle throws "Transaction function cannot
 * return a promise".
 */
export async function deleteAccountCompletely(accountId: string): Promise<{
  deletedProfiles: number;
}> {
  return await new Promise<{ deletedProfiles: number }>((resolve, reject) => {
    try {
      db.transaction((tx) => {
        const accountProfiles = tx
          .select({ id: profiles.id })
          .from(profiles)
          .where(eq(profiles.accountId, accountId))
          .all();

        for (const profile of accountProfiles) {
          tx.delete(watchHistory).where(eq(watchHistory.profileId, profile.id)).run();
          tx.delete(sessions).where(eq(sessions.profileId, profile.id)).run();
          tx.delete(profileSettings).where(eq(profileSettings.profileId, profile.id)).run();
          tx.delete(profiles).where(eq(profiles.id, profile.id)).run();
        }

        // sessions also FK directly to accounts.account_id, so clear any that
        // were created for the account even if their profile is already gone.
        tx.delete(sessions).where(eq(sessions.accountId, accountId)).run();

        // Clear message views FIRST: they FK to both adminMessages.messageId and
        // accounts.accountId (no ON DELETE CASCADE), so deleting either parent
        // fails whenever a view row exists. This removes the account's views of
        // targeted AND broadcast messages, unblocking both parent deletions.
        tx.delete(messageViews).where(eq(messageViews.accountId, accountId)).run();

        tx.delete(adminMessages).where(eq(adminMessages.accountId, accountId)).run();
        tx.delete(contactSubmissions).where(eq(contactSubmissions.accountId, accountId)).run();
        tx.delete(paymentSubmissions).where(eq(paymentSubmissions.accountId, accountId)).run();

        // Password reset tokens FK to accounts.account_id (no cascade).
        tx.delete(passwordResetTokens).where(eq(passwordResetTokens.accountId, accountId)).run();

        tx.delete(accounts).where(eq(accounts.id, accountId)).run();

        resolve({ deletedProfiles: accountProfiles.length });
      });
    } catch (e) {
      reject(e);
    }
  });
}

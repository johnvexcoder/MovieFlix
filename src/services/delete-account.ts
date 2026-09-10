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
  myList,
  signupSessions,
  billingEvents,
  billingOrders,
  promoCodes,
  promoRedemptions,
  subscriptions,
} from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

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
        const profileIds = accountProfiles.map((profile) => profile.id);

        // Release promo capacity held by abandoned QR orders before removing
        // immutable billing history for this deliberately deleted account.
        const accountOrders = tx
          .select({ id: billingOrders.id, promoId: billingOrders.promoId, promoReserved: billingOrders.promoReserved })
          .from(billingOrders)
          .where(eq(billingOrders.accountId, accountId))
          .all();
        for (const order of accountOrders) {
          if (order.promoId && order.promoReserved) {
            tx.update(promoCodes)
              .set({ reservedUses: sql`max(0, ${promoCodes.reservedUses} - 1)` })
              .where(eq(promoCodes.id, order.promoId))
              .run();
          }
          tx.delete(billingEvents).where(eq(billingEvents.orderId, order.id)).run();
          tx.delete(promoRedemptions).where(eq(promoRedemptions.orderId, order.id)).run();
        }
        tx.delete(billingOrders).where(eq(billingOrders.accountId, accountId)).run();
        tx.delete(promoRedemptions).where(eq(promoRedemptions.accountId, accountId)).run();
        tx.delete(subscriptions).where(eq(subscriptions.accountId, accountId)).run();

        // Rows that can reference both an account and a profile must be removed
        // before profiles, otherwise SQLite correctly blocks the deletion.
        tx.delete(contactSubmissions).where(eq(contactSubmissions.accountId, accountId)).run();
        tx.delete(sessions).where(eq(sessions.accountId, accountId)).run();
        if (profileIds.length > 0) {
          tx.delete(contactSubmissions).where(inArray(contactSubmissions.profileId, profileIds)).run();
          tx.delete(myList).where(inArray(myList.profileId, profileIds)).run();
          tx.delete(watchHistory).where(inArray(watchHistory.profileId, profileIds)).run();
          tx.delete(sessions).where(inArray(sessions.profileId, profileIds)).run();
          tx.delete(profileSettings).where(inArray(profileSettings.profileId, profileIds)).run();
          tx.delete(profiles).where(inArray(profiles.id, profileIds)).run();
        }

        // Remove account-scoped communication and legacy checkout records.
        tx.delete(messageViews).where(eq(messageViews.accountId, accountId)).run();
        const targetedMessages = tx.select({ id: adminMessages.id }).from(adminMessages).where(eq(adminMessages.accountId, accountId)).all();
        if (targetedMessages.length > 0) {
          tx.delete(messageViews).where(inArray(messageViews.messageId, targetedMessages.map((message) => message.id))).run();
        }
        tx.delete(adminMessages).where(eq(adminMessages.accountId, accountId)).run();
        tx.delete(paymentSubmissions).where(eq(paymentSubmissions.accountId, accountId)).run();
        tx.delete(passwordResetTokens).where(eq(passwordResetTokens.accountId, accountId)).run();
        tx.delete(signupSessions).where(eq(signupSessions.accountId, accountId)).run();

        tx.delete(accounts).where(eq(accounts.id, accountId)).run();

        resolve({ deletedProfiles: accountProfiles.length });
      });
    } catch (e) {
      reject(e);
    }
  });
}

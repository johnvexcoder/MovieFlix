import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { setupDatabase, db } from "../src/db";
import { accounts, billingOrders, promoCodes, promoRedemptions, signupSessions, subscriptionPlans } from "../src/db/schema";
import { hashSignupToken } from "../src/lib/registration";
import { createOrder, fulfillOrder, reconcilePayMongoOrders, releaseExpiredReservations } from "../src/services/billing/service";
import { deleteAccountCompletely } from "../src/services/delete-account";
import { cleanupExpiredAccounts } from "../src/services/account-cleanup";

async function main() {
  process.env.PAYMONGO_SECRET_KEY = "sk_test_billing_smoke";
  process.env.PAYMONGO_PUBLIC_KEY = "pk_test_billing_smoke";
  setupDatabase();
  const now = new Date().toISOString();
  const accountId = randomUUID(), planId = randomUUID(), promoId = randomUUID(), token = "x".repeat(40);
  await db.insert(accounts).values({ id: accountId, username: "billing-test", email: "billing@test.local", passwordHash: "unused", registrationStatus: "pending", isLocked: true, createdAt: now, updatedAt: now });
  await db.insert(subscriptionPlans).values({ id: planId, name: "1 Month", durationHours: 720, isLifetime: false, price: 100, discountAmount: 0, isActive: true, sortOrder: 1, createdAt: now, updatedAt: now });
  await db.insert(promoCodes).values({ id: promoId, code: "TEST25", discountType: "percent", percentOff: 25, discountAmount: 0, perAccountLimit: 1, maxUses: 1, uses: 0, reservedUses: 0, createdAt: now, updatedAt: now });
  await db.insert(signupSessions).values({ id: randomUUID(), accountId, tokenHash: hashSignupToken(token), expiresAt: new Date(Date.now() + 3_600_000).toISOString(), createdAt: now });
  let calls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls += 1; const url = String(input);
    if (url.endsWith("/payment_intents")) return new Response(JSON.stringify({ data: { id: "pi_test", attributes: { client_key: "client_test" } } }));
    if (url.endsWith("/payment_methods")) return new Response(JSON.stringify({ data: { id: "pm_test" } }));
    return new Response(JSON.stringify({ data: { attributes: { status: "awaiting_next_action", next_action: { code: { image_url: "data:image/png;base64,AA==" } } } } }));
  }) as typeof fetch;
  const order = await createOrder(new Request("http://localhost/api/billing/orders"), { planId, promoCode: "TEST25", signupToken: token });
  if (order.amountMinor !== 7500 || calls !== 3) throw new Error("Authoritative price or provider flow failed");
  const event = { providerIntentId: "pi_test", providerEventId: "evt_test", eventType: "payment.paid", providerPaymentId: "pay_test", amountMinor: 7500, currency: "PHP" };
  await fulfillOrder(event); await fulfillOrder(event);
  const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.id, promoId));
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(promoRedemptions);
  const [saved] = await db.select().from(billingOrders).where(eq(billingOrders.id, order.id));
  if (promo.uses !== 1 || promo.reservedUses !== 0 || count !== 1 || saved.status !== "PAID") throw new Error("Idempotency or redemption accounting failed");

  // A paid Payment Intent must activate access even if its webhook was missed.
  const reconcileAccountId = randomUUID(), reconcileOrderId = randomUUID();
  await db.insert(accounts).values({ id: reconcileAccountId, username: `reconcile-${reconcileAccountId}`, passwordHash: "unused", registrationStatus: "pending", isLocked: true, createdAt: now, updatedAt: now });
  await db.insert(billingOrders).values({ id: reconcileOrderId, accountId: reconcileAccountId, planId, planNameSnapshot: "1 Month", planDurationHoursSnapshot: 720, planLifetimeSnapshot: false, originalAmountMinor: 1000, discountAmountMinor: 0, finalAmountMinor: 1000, currency: "PHP", provider: "paymongo", providerIntentId: "pi_reconcile", status: "PENDING", expiresAt: new Date(Date.now() + 60_000).toISOString(), createdAt: now, updatedAt: now });
  globalThis.fetch = (async () => new Response(JSON.stringify({ data: { id: "pi_reconcile", attributes: { status: "succeeded", amount: 1000, currency: "PHP", payments: [{ id: "pay_reconcile", attributes: { status: "paid", amount: 1000, currency: "PHP" } }] } } }))) as typeof fetch;
  if (await reconcilePayMongoOrders(reconcileAccountId, reconcileOrderId) !== 1) throw new Error("Paid Payment Intent was not reconciled");
  const [reconciledAccount] = await db.select().from(accounts).where(eq(accounts.id, reconcileAccountId));
  const [reconciledOrder] = await db.select().from(billingOrders).where(eq(billingOrders.id, reconcileOrderId));
  if (reconciledAccount.isLocked || reconciledAccount.registrationStatus !== "active" || reconciledOrder.status !== "PAID" || reconciledOrder.providerPaymentId !== "pay_reconcile") throw new Error("Missed webhook reconciliation did not activate access");

  // A missed PayMongo expiry webhook must not leave a QR payment pending.
  const abandonedAccountId = randomUUID(), abandonedOrderId = randomUUID();
  await db.insert(accounts).values({ id: abandonedAccountId, username: `abandoned-${abandonedAccountId}`, passwordHash: "unused", registrationStatus: "pending", isLocked: true, createdAt: now, updatedAt: now });
  await db.insert(billingOrders).values({ id: abandonedOrderId, accountId: abandonedAccountId, planId, planNameSnapshot: "1 Month", planDurationHoursSnapshot: 720, planLifetimeSnapshot: false, originalAmountMinor: 10000, discountAmountMinor: 0, finalAmountMinor: 10000, currency: "PHP", provider: "paymongo", status: "PENDING", expiresAt: new Date(Date.now() - 60_000).toISOString(), createdAt: now, updatedAt: now });
  if (await releaseExpiredReservations() < 1) throw new Error("Expired payment was not reconciled");
  const [expired] = await db.select().from(billingOrders).where(eq(billingOrders.id, abandonedOrderId));
  if (expired.status !== "EXPIRED") throw new Error("Abandoned payment did not become EXPIRED");

  // An expired historical signup session must never delete a paid account,
  // including when automatic cleanup is explicitly enabled for trial accounts.
  process.env.TRIAL_AUTO_DELETE_EXPIRED = "true";
  await db.update(signupSessions).set({ expiresAt: new Date(Date.now() - 60_000).toISOString() }).where(eq(signupSessions.accountId, accountId));
  await cleanupExpiredAccounts();
  const paidAccountStillExists = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (paidAccountStillExists.length !== 1) throw new Error("Paid account was deleted because an old signup session expired");

  // Admin deletion must remove both completed and abandoned billing graphs.
  await deleteAccountCompletely(accountId);
  await deleteAccountCompletely(abandonedAccountId);
  await deleteAccountCompletely(reconcileAccountId);
  const deletedAccounts = await db.select().from(accounts).where(eq(accounts.id, accountId));
  const deletedOrders = await db.select().from(billingOrders).where(eq(billingOrders.accountId, abandonedAccountId));
  if (deletedAccounts.length || deletedOrders.length) throw new Error("Safe account deletion left dependent records behind");
  console.log("Billing smoke test passed");
}
main().catch((error) => { console.error(error); process.exit(1); });

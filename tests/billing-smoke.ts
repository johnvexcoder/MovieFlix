import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import { setupDatabase, db } from "../src/db";
import { accounts, billingOrders, promoCodes, promoRedemptions, signupSessions, subscriptionPlans } from "../src/db/schema";
import { hashSignupToken } from "../src/lib/registration";
import { createOrder, fulfillOrder } from "../src/services/billing/service";

async function main() {
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
  console.log("Billing smoke test passed");
}
main().catch((error) => { console.error(error); process.exit(1); });

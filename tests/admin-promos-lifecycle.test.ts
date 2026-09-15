import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "movieflix-promos-test-"));
Object.assign(process.env, { NODE_ENV: "test", DATABASE_PATH: path.join(temp, "db.sqlite"),
  JWT_SECRET: "test-admin-secret-that-is-long-and-unique-123",
  JWT_REFRESH_SECRET: "test-admin-refresh-that-is-long-and-unique-456" });

async function main() {
  try {
    const { setupDatabase, db } = await import("../src/db/index");
    const { promoCodes, accounts, billingOrders, subscriptionPlans } = await import("../src/db/schema");
    const { generateAccessToken } = await import("../src/lib/auth");
    const { PATCH, DELETE } = await import("../src/app/api/admin/promos/route");
    const { eq } = await import("drizzle-orm");
    setupDatabase();
    const now = new Date().toISOString();
    await db.insert(promoCodes).values({ id: "unused", code: "UNUSED", isActive: false,
      createdAt: now, updatedAt: now });
    await db.insert(promoCodes).values({ id: "used", code: "USED", isActive: true,
      createdAt: now, updatedAt: now });
    await db.insert(accounts).values({ id: "account", username: "customer", passwordHash: "x",
      createdAt: now, updatedAt: now });
    await db.insert(subscriptionPlans).values({ id: "plan", name: "Plan", price: 1,
      createdAt: now, updatedAt: now });
    await db.insert(billingOrders).values({ id: "order", accountId: "account", planId: "plan", promoId: "used",
      planNameSnapshot: "Plan", originalAmountMinor: 100, finalAmountMinor: 100,
      createdAt: now, updatedAt: now });
    const token = generateAccessToken({ profileId: "admin", accountId: "admin", isAdmin: true, fingerprint: "test" });
    const cookie = `admin_token=${token}`;
    const enabled = await PATCH(new Request("http://localhost/api/admin/promos", { method: "PATCH",
      headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ id: "unused", action: "enable" }) }));
    assert.equal(enabled.status, 200);
    assert.equal((await db.select().from(promoCodes).where(eq(promoCodes.id, "unused")))[0].isActive, true);
    const denied = await DELETE(new Request("http://localhost/api/admin/promos?id=used&remove=1", { method: "DELETE", headers: { cookie } }));
    assert.equal(denied.status, 409);
    const removed = await DELETE(new Request("http://localhost/api/admin/promos?id=unused&remove=1", { method: "DELETE", headers: { cookie } }));
    assert.equal(removed.status, 200);
    assert.equal((await db.select().from(promoCodes).where(eq(promoCodes.id, "unused"))).length, 0);
    console.log("Promotion enable and history-safe delete passed");
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });

import { getDb, setupDatabase } from "../src/db";
import { accounts, profiles, profileSettings, sessions, adminMessages, contactSubmissions, paymentSubmissions, messageViews, passwordResetTokens, paymentMethods, admins } from "../src/db/schema";
import { v4 as uuidv4 } from "uuid";
import { cleanupExpiredAccounts } from "../src/services/account-cleanup";
import { deleteAccountCompletely } from "../src/services/delete-account";
import path from "path";
import fs from "fs";

const dbFile = path.join("/tmp/opencode", `cleanup-test-${Date.now()}.sqlite`);
const dir = path.dirname(dbFile);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
const prev = process.env.DATABASE_PATH;
process.env.DATABASE_PATH = dbFile;

setupDatabase();
const db = getDb();
const now = new Date().toISOString();
const past = new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(); // expired 48h ago

async function seedAccount(username: string) {
  const accId = uuidv4();
  const adminId = uuidv4();
  await db.insert(admins).values({ id: adminId, username: "ta" + adminId.slice(0, 6), passwordHash: "x", createdAt: now });
  await db.insert(accounts).values({ id: accId, username, passwordHash: "x", expiresAt: past, createdAt: now, updatedAt: now });

  const profId = uuidv4();
  await db.insert(profiles).values({ id: profId, accountId: accId, name: "Main", isMainProfile: true, createdAt: now, updatedAt: now });
  await db.insert(profileSettings).values({ id: uuidv4(), profileId: profId });
  await db.insert(sessions).values({
    id: uuidv4(), profileId: profId, accountId: accId, fingerprint: "fp", ipSubnet: "1.2.3.0/24",
    userAgent: "test", expiresAt: new Date(Date.now() + 3600e3).toISOString(), createdAt: now,
  });

  // broadcast admin message + messageView FK to both admin_messages and accounts
  const msgId = uuidv4();
  await db.insert(adminMessages).values({ id: msgId, message: "hi", createdByAdminId: adminId, createdAt: now });
  await db.insert(messageViews).values({ id: uuidv4(), accountId: accId, messageId: msgId, viewedAt: now });

  // contact + payment submissions referencing account
  await db.insert(contactSubmissions).values({ id: uuidv4(), type: "report", message: "m", accountId: accId, createdAt: now });
  const pmId = uuidv4();
  await db.insert(paymentMethods).values({ id: pmId, name: "card", accountNumber: "123" });
  await db.insert(paymentSubmissions).values({
    id: uuidv4(), paymentMethodId: pmId, accountId: accId, senderName: "n", senderAccountNumber: "a",
    amount: 1, referenceNumber: "r", createdAt: now, updatedAt: now,
  });
  await db.insert(passwordResetTokens).values({ id: uuidv4(), accountId: accId, tokenHash: "h", expiresAt: now, createdAt: now });

  return accId;
}

(async () => {
  try {
    await seedAccount("expired_a");
    await seedAccount("expired_b");

    // 1) Auto-cleanup path removes both expired accounts
    const beforeAccs = await db.select({ id: accounts.id }).from(accounts);
    const res = await cleanupExpiredAccounts();
    const afterAccs = await db.select({ id: accounts.id }).from(accounts);
    console.log("auto-cleanup result:", res);
    console.log("expired accounts before:", beforeAccs.length, "after:", afterAccs.length);
    if (afterAccs.length !== 0) throw new Error("FAIL: expired accounts not auto-deleted");

    // 2) Manual delete path on a fresh account
    const manualId = await seedAccount("manual_del");
    const dr = await deleteAccountCompletely(manualId);
    const left = await db.select({ id: accounts.id }).from(accounts);
    console.log("manual delete result:", dr);
    if (left.some((a) => a.id === manualId)) throw new Error("FAIL: manual delete left account row");

    console.log("PASS: both auto-cleanup and manual delete remove accounts with all FK dependents.");
  } catch (e) {
    console.error("TEST FAILED:", e);
    process.exitCode = 1;
  } finally {
    try {
      fs.rmSync(dbFile, { force: true });
      fs.rmSync(dbFile + "-wal", { force: true });
      fs.rmSync(dbFile + "-shm", { force: true });
    } catch {}
    if (prev) process.env.DATABASE_PATH = prev;
  }
})();

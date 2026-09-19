import { and, eq, gte, gt, isNull, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { accounts, billingOrders, reminderHistory } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { emailLayout, escapeHtml, greeting } from "@/lib/email-templates";
import { getSetting } from "@/lib/app-settings";

/**
 * Subscription reminder + expired-account email runner.
 *
 * Used by both the `/api/cron/payment-reminder` HTTP endpoint and the built-in
 * twice-daily scheduler in `instrumentation.ts`.
 *
 * Reminders are de-duplicated PER SCHEDULED SLOT, not per day and not once ever:
 *   - A MORNING and an AFTERNOON reminder on the same date are both allowed.
 *   - The same (account, date, slot) can never be sent twice (idempotent), so a
 *     cron re-run or container restart cannot produce duplicates.
 *   - Only LIMITED (expiring) accounts are eligible; permanent/lifetime accounts
 *     are excluded.
 *
 * The slot is derived from the configured application timezone (default
 * Asia/Manila). "MORNING" = hour < 12, "AFTERNOON" = hour >= 12.
 */
export async function runSubscriptionReminders(): Promise<{ reminded: number; expired: number }> {
  const tz = (await getSetting<string>("app_timezone", "Asia/Manila")) || "Asia/Manila";
  const { date: today, slot } = currentSlotAndDate(tz);

  const now = new Date();
  const nowISO = now.toISOString();
  const reminderDays = Math.max(1, parseInt(await getSetting("reminder_days", "3"), 10) || 3);
  const windowISO = new Date(now.getTime() + reminderDays * 24 * 60 * 60 * 1000).toISOString();

  // Accounts already reminded in this (date, slot).
  const alreadySent = await db
    .select({ accountId: reminderHistory.accountId })
    .from(reminderHistory)
    .where(and(eq(reminderHistory.reminderDate, today), eq(reminderHistory.slot, slot)));
  const sentIds = new Set(alreadySent.map((r) => r.accountId));

  // Eligible accounts: expiring within the window, not yet expired, active, not
  // already reminded in this slot.
  const expiring = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      fullName: accounts.fullName,
      username: accounts.username,
      expiresAt: accounts.expiresAt,
    })
    .from(accounts)
    .where(
      and(
        gte(accounts.expiresAt, nowISO),
        lt(accounts.expiresAt, windowISO),
        eq(accounts.registrationStatus, "active")
      )
    );

  let reminded = 0;

  for (const acc of expiring) {
    if (!acc.email || !acc.expiresAt) continue;
    if (sentIds.has(acc.id)) continue;

    const dateStr = new Date(acc.expiresAt).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const bodyHtml = `
      ${greeting(escapeHtml(acc.fullName || acc.username))}
      <p>Your MovieFlix subscription is set to expire on <strong>${dateStr}</strong>.</p>
      <p>To avoid interruption, please renew your plan before the expiration date.</p>
      <p>If you have already renewed, please disregard this email.</p>
    `;
    const ok = await sendEmail({
      to: acc.email,
      subject: "Your MovieFlix subscription is expiring soon",
      html: emailLayout({ title: "Subscription Expiration Reminder", bodyHtml }),
    });
    if (!ok) continue; // do not mark as sent when delivery failed

    await db.insert(reminderHistory).values({
      id: uuidv4(),
      accountId: acc.id,
      reminderDate: today,
      slot,
      sentAt: nowISO,
    });
    console.log(`[Expiration Reminder] accountId=${acc.id} expirationDate=${acc.expiresAt} slot=${slot} status=SENT`);
    reminded++;
  }

  let expired = 0;

  // Accounts that have expired, still marked active, not already notified, and
  // with no PAID order after the expiration date.
  const expiredAccounts = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      fullName: accounts.fullName,
      username: accounts.username,
      expiresAt: accounts.expiresAt,
    })
    .from(accounts)
    .where(
      and(
        lt(accounts.expiresAt, nowISO),
        eq(accounts.registrationStatus, "active"),
        isNull(accounts.expiryEmailAt)
      )
    );

  for (const acc of expiredAccounts) {
    if (!acc.email || !acc.expiresAt) continue;
    const recentPaidOrder = await db
      .select({ id: billingOrders.id })
      .from(billingOrders)
      .where(
        and(
          eq(billingOrders.accountId, acc.id),
          eq(billingOrders.status, "PAID"),
          gt(billingOrders.paidAt ?? "", acc.expiresAt)
        )
      )
      .limit(1);
    if (recentPaidOrder.length > 0) continue;

    const expiredDate = new Date(acc.expiresAt).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const bodyHtml = `
      ${greeting(escapeHtml(acc.fullName || acc.username))}
      <p>Your MovieFlix subscription has expired on <strong>${expiredDate}</strong>.</p>
      <p>Your access to MovieFlix has been suspended. To restore access, please renew your plan.</p>
    `;
    const ok = await sendEmail({
      to: acc.email,
      subject: "Your MovieFlix subscription has expired",
      html: emailLayout({ title: "Subscription Expired", bodyHtml }),
    });
    if (ok) {
      await db.update(accounts).set({ expiryEmailAt: nowISO, updatedAt: nowISO }).where(eq(accounts.id, acc.id));
      expired++;
    }
  }

  return { reminded, expired };
}

/** Computes today's date (YYYY-MM-DD) and the reminder slot in the given timezone. */
function currentSlotAndDate(tz: string): { date: string; slot: "MORNING" | "AFTERNOON" } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const hour = parseInt(get("hour"), 10) || 0;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    slot: hour < 12 ? "MORNING" : "AFTERNOON",
  };
}
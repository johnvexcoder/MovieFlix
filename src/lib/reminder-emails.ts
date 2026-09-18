import { and, eq, gte, gt, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { accounts, billingOrders } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { emailLayout, escapeHtml, greeting } from "@/lib/email-templates";
import { getSetting } from "@/lib/app-settings";

/**
 * Subscription reminder + expired-account email runner.
 *
 * This is the single source of truth used by both the `/api/cron/payment-reminder`
 * HTTP endpoint (external cron) and the built-in twice-daily scheduler wired in
 * `instrumentation.ts`. It is idempotent:
 *   - Each expiring account receives exactly ONE reminder (`reminder_email_at`).
 *   - Each expired account receives exactly ONE expiration notice (`expiry_email_at`).
 *
 * The reminder window is driven by the admin `reminder_days` setting (default 3),
 * so it works when an account has e.g. 3 days (or the configured window) remaining.
 */
export async function runSubscriptionReminders(): Promise<{ reminded: number; expired: number }> {
  const now = new Date();
  const nowISO = now.toISOString();
  const reminderDays = Math.max(1, parseInt(await getSetting("reminder_days", "3"), 10) || 3);
  const windowISO = new Date(now.getTime() + reminderDays * 24 * 60 * 60 * 1000).toISOString();

  let reminded = 0;

  // Accounts expiring within the reminder window, not yet expired, active, and
  // not already reminded.
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
        eq(accounts.registrationStatus, "active"),
        isNull(accounts.reminderEmailAt)
      )
    );

  for (const acc of expiring) {
    if (!acc.email || !acc.expiresAt) continue;
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
    if (ok) {
      await db.update(accounts).set({ reminderEmailAt: nowISO, updatedAt: nowISO }).where(eq(accounts.id, acc.id));
      reminded++;
    }
  }

  let expired = 0;

  // Accounts that have expired, still marked active (renewal not yet applied),
  // not already notified, and with no PAID order after the expiration date.
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
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { accounts, billingOrders } from "@/db/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { emailLayout, escapeHtml, greeting } from "@/lib/email-templates";

export async function GET(request: NextRequest) {
  // Optional: protect with a secret key to prevent public access
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const now = new Date();
  const nowISO = now.toISOString();
  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);
  const threeDaysLaterISO = threeDaysLater.toISOString();

  // Fetch accounts that are active (not expired) and expires within next 3 days
  const accountsToRemind = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      fullName: accounts.fullName,
      expiresAt: accounts.expiresAt,
    })
    .from(accounts)
    .where(
      and(
        gte(accounts.expiresAt, nowISO), // not yet expired
        lt(accounts.expiresAt, threeDaysLaterISO), // within next 3 days
        eq(accounts.registrationStatus, "active") // only active accounts
      )
    );

  // Send reminder emails
  for (const acc of accountsToRemind) {
    if (!acc.email) continue;
    const expiresAt = new Date(acc.expiresAt!);
    const dateStr = expiresAt.toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const bodyHtml = `
      ${greeting(escapeHtml(acc.fullName || acc.username))}
      <p>Your MovieFlix subscription is set to expire on <strong>${dateStr}</strong>.</p>
      <p>To avoid interruption, please renew your plan before the expiration date.</p>
      <p>If you have already renewed, please disregard this email.</p>
    `;
    await sendEmail({
      to: acc.email,
      subject: 'Your MovieFlix subscription is expiring soon',
      html: emailLayout({ title: 'Subscription Expiration Reminder', bodyHtml }),
    });
  }

  // Fetch accounts that have expired (expiresAt < now) and have not renewed after expiration
  const expiredAccounts = await db
    .select({
      id: accounts.id,
      email: accounts.email,
      fullName: accounts.fullName,
      expiresAt: accounts.expiresAt,
    })
    .from(accounts)
    .where(
      and(
        lt(accounts.expiresAt, nowISO), // expired
        eq(accounts.registrationStatus, "active") // still considered active (maybe not yet updated)
      )
    );

  for (const acc of expiredAccounts) {
    if (!acc.email) continue;
    // Check if there is a paid order after the expiration date (indicating renewal)
    const recentPaidOrder = await db
      .select({ id: billingOrders.id })
      .from(billingOrders)
      .where(
        and(
          eq(billingOrders.accountId, acc.id),
          eq(billingOrders.status, "PAID"),
          gt(billingOrders.paidAt!, acc.expiresAt!) // paid after expiration
        )
      )
      .limit(1);

    if (recentPaidOrder.length === 0) {
      // No renewal found, send expiration notice
      const expiredDate = new Date(acc.expiresAt!).toLocaleDateString('en-PH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const bodyHtml = `
        ${greeting(escapeHtml(acc.fullName || acc.username))}
        <p>Your MovieFlix subscription has expired on <strong>${expiredDate}</strong>.</p>
        <p>Your access to MovieFlix has been suspended. To restore access, please renew your plan.</p>
      `;
      await sendEmail({
        to: acc.email,
        subject: 'Your MovieFlix subscription has expired',
        html: emailLayout({ title: 'Subscription Expired', bodyHtml }),
      });
      // Optionally update registrationStatus to 'expired' or similar
      // await db.update(accounts).set({ registrationStatus: 'expired', updatedAt: nowISO }).where(eq(accounts.id, acc.id));
    }
  }

  return new NextResponse("Reminder cron executed", { status: 200 });
}
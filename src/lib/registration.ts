import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, promoCodes, signupSessions, subscriptionPlans } from "@/db/schema";

export const hashSignupToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export async function getSignupAccount(token: string) {
  if (!token || token.length < 32) return null;
  const [row] = await db.select({ session: signupSessions, account: accounts }).from(signupSessions)
    .innerJoin(accounts, eq(signupSessions.accountId, accounts.id))
    .where(and(eq(signupSessions.tokenHash, hashSignupToken(token)), eq(accounts.registrationStatus, "pending"))).limit(1);
  if (!row || row.session.completedAt || Date.parse(row.session.expiresAt) <= Date.now()) return null;
  return row;
}
export async function calculateQuote(token: string, planId: string, rawCode?: string) {
  const signup = await getSignupAccount(token);
  if (!signup) return { error: "Registration session is invalid or expired", status: 401 } as const;
  let selectedPlanId = planId; let promo: typeof promoCodes.$inferSelect | null = null;
  const code = rawCode?.trim().toUpperCase();
  if (code) {
    [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, code)).limit(1);
    const now = Date.now(); const dobMonth = signup.account.dateOfBirth ? new Date(`${signup.account.dateOfBirth}T00:00:00`).getMonth() : -1;
    if (!promo || !promo.isActive || (promo.startsAt && Date.parse(promo.startsAt) > now) || (promo.expiresAt && Date.parse(promo.expiresAt) < now) ||
      (promo.maxUses != null && promo.uses >= promo.maxUses) || (promo.birthdayMonthOnly && dobMonth !== new Date().getMonth()))
      return { error: "Promo or redeem code is invalid or not eligible for this account", status: 400 } as const;
    if (promo.forcedPlanId) selectedPlanId = promo.forcedPlanId;
  }
  const [plan] = await db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.id, selectedPlanId), eq(subscriptionPlans.isActive, true))).limit(1);
  if (!plan) return { error: "Selected plan is unavailable", status: 404 } as const;
  const activeDiscount = plan.discountAmount > 0 && (!plan.discountUntil || Date.parse(plan.discountUntil) >= Date.now());
  const originalPrice = Math.max(0, plan.price);
  const amount = Math.max(0, Math.round((originalPrice - (activeDiscount ? plan.discountAmount : 0) - (promo?.discountAmount || 0)) * 100) / 100);
  const totalDiscount = originalPrice - amount;
  return { signup, plan, promo, originalPrice, amount, totalDiscount, percentOff: originalPrice > 0 ? Math.round(totalDiscount / originalPrice * 100) : 0 } as const;
}

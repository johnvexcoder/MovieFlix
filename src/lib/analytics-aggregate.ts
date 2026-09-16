// Daily analytics aggregation. One row per UTC day in analytics_daily.
// Idempotent: every day is recomputed from the raw tables and upserted by date,
// so backfills can re-run any range (past days never mutate except when a
// refund record is later added to a prior day).
import { and, eq, gt, gte, isNull, lt, lte, or, count, sum, sql } from "drizzle-orm";
import { db } from "@/db";
import { analyticsDaily, billingOrders, playbackSessions, subscriptions } from "@/db/schema";
import { concurrencyStats } from "./concurrency";

export function dateKeyOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return dateKeyOf(new Date());
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function eachDay(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  const from = parseKey(fromKey).getTime();
  const to = parseKey(toKey).getTime();
  for (let ms = from; ms <= to; ms += 86400000) out.push(dateKeyOf(new Date(ms)));
  return out;
}

async function firstPaidByAccount(): Promise<Map<string, string>> {
  const rows = await db.all<{ account_id: string; first_paid: string }>(
    sql`SELECT account_id, MIN(paid_at) AS first_paid FROM billing_orders WHERE status = 'PAID' GROUP BY account_id`
  );
  return new Map(rows.map((r) => [r.account_id, r.first_paid]));
}

async function lastPaidByAccount(): Promise<Map<string, { minor: number; paidMs: number }>> {
  const rows = await db.all<{ account_id: string; final_amount_minor: number; paid_at: string }>(
    sql`SELECT account_id, final_amount_minor, paid_at FROM billing_orders WHERE status = 'PAID'`
  );
  const map = new Map<string, { minor: number; paidMs: number }>();
  for (const r of rows) {
    const paidMs = Date.parse(r.paid_at);
    const cur = map.get(r.account_id);
    if (!cur || paidMs > cur.paidMs) {
      map.set(r.account_id, { minor: Number(r.final_amount_minor) || 0, paidMs });
    }
  }
  return map;
}

export async function earliestRelevantDateKey(): Promise<string> {
  try {
const rows = await db.all<{ d: string | null }>(
    sql`SELECT MIN(m) AS d FROM (
        SELECT MIN(created_at) AS m FROM subscriptions
        UNION ALL SELECT MIN(paid_at) FROM billing_orders
        UNION ALL SELECT MIN(created_at) FROM playback_sessions
      )`
  );
    const raw = rows[0]?.d;
    const ms = raw ? Date.parse(raw) : NaN;
    return Number.isFinite(ms) ? dateKeyOf(new Date(ms)) : todayKey();
  } catch (error) {
    console.error("analytics.earliest_error", error);
    return todayKey();
  }
}

export async function aggregateDay(dateKey: string): Promise<void> {
  const dayStart = parseKey(dateKey).getTime();
  const dayEnd = dayStart + 86400000;
  const nowMs = Date.now();
  const capMs = Math.min(dayEnd, nowMs);
  const startISO = new Date(dayStart).toISOString();
  const capISO = new Date(capMs).toISOString();

  // ---- Revenue + transactions from PAID orders paid within the day.
  const dayOrders = await db
    .select({
      accountId: billingOrders.accountId,
      originalAmountMinor: billingOrders.originalAmountMinor,
      discountAmountMinor: billingOrders.discountAmountMinor,
      finalAmountMinor: billingOrders.finalAmountMinor,
      paidAt: billingOrders.paidAt,
    })
    .from(billingOrders)
    .where(and(eq(billingOrders.status, "PAID"), gte(billingOrders.paidAt, startISO), lt(billingOrders.paidAt, capISO)));

  const transactions = dayOrders.length;
  const revenueGrossMinor = dayOrders.reduce((s, o) => s + (o.originalAmountMinor || 0), 0);
  const revenueDiscountMinor = dayOrders.reduce((s, o) => s + (o.discountAmountMinor || 0), 0);
  const revenueNetMinor = dayOrders.reduce((s, o) => s + (o.finalAmountMinor || 0), 0);

  // ---- Refunds recorded within the day.
  const [refundRow] = await db
    .select({ total: sum(billingOrders.refundAmountMinor) })
    .from(billingOrders)
    .where(and(gte(billingOrders.refundedAt, startISO), lt(billingOrders.refundedAt, capISO)));
  const revenueRefundMinor = Number(refundRow?.total ?? 0) || 0;

  // ---- New vs renewed subscribers (accounts with a PAID order in the day).
  let newSubscribers = 0;
  let renewedSubscriptions = 0;
  if (dayOrders.length > 0) {
    const firstPaid = await firstPaidByAccount();
    const byAccount = new Map<string, string>();
    for (const o of dayOrders) {
      if (!o.paidAt) continue;
      const cur = byAccount.get(o.accountId);
      if (!cur || o.paidAt < cur) byAccount.set(o.accountId, o.paidAt);
    }
    for (const [accountId, minPaidInDay] of byAccount) {
      if (firstPaid.get(accountId) === minPaidInDay) newSubscribers += 1;
      else renewedSubscriptions += 1;
    }
  }

  // ---- Expired / cancelled subscriptions (period ended within the day).
  async function countEndingInDay(cancelOnly?: boolean) {
    const [row] = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.isLifetime, false),
          gte(subscriptions.currentPeriodEnd, startISO),
          lt(subscriptions.currentPeriodEnd, capISO),
          cancelOnly === true ? eq(subscriptions.cancelAtPeriodEnd, true) : undefined
        )
      );
    return Number(row.count) || 0;
  }
  const expiredSubscriptions = await countEndingInDay(false);
  const cancelledSubscriptions = await countEndingInDay(true);

  // ---- Active subscribers as of the capped day end.
  const [activeRow] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "ACTIVE"),
        or(
          eq(subscriptions.isLifetime, true),
          and(
            gt(subscriptions.currentPeriodEnd, capISO),
            or(isNull(subscriptions.currentPeriodStart), lte(subscriptions.currentPeriodStart, capISO))
          )
        )
      )
    );
  const activeSubscribers = Number(activeRow.count) || 0;

  // ---- Auto-renew enabled accounts at the capped day end + potential value.
  const autoRenewSubs = await db
    .select({ accountId: subscriptions.accountId })
    .from(subscriptions)
    .where(and(eq(subscriptions.autoRenew, true), eq(subscriptions.status, "ACTIVE")));
  const autoRenewEnabled = autoRenewSubs.length;
  let autoRenewPotentialValueMinor = 0;
  if (autoRenewEnabled > 0) {
    const lastPaid = await lastPaidByAccount();
    for (const s of autoRenewSubs) autoRenewPotentialValueMinor += lastPaid.get(s.accountId)?.minor || 0;
  }

  // ---- Churn-risk buckets: expiring within N days and NOT on auto-renew.
  async function churnRisk(daysForward: number): Promise<number> {
    const until = capMs + daysForward * 86400000;
    const [row] = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.isLifetime, false),
          gt(subscriptions.currentPeriodEnd, capISO),
          lte(subscriptions.currentPeriodEnd, new Date(until).toISOString()),
          or(eq(subscriptions.autoRenew, false), eq(subscriptions.cancelAtPeriodEnd, true))
        )
      );
    return Number(row.count) || 0;
  }
  const autoRenewChurnRisk24h = await churnRisk(1);
  const autoRenewChurnRisk3d = await churnRisk(3);
  const autoRenewChurnRisk7d = await churnRisk(7);

  // ---- Streaming: sessions overlapping the day, clipped to "now".
  const sessions = await db
    .select({
      accountId: playbackSessions.accountId,
      createdAt: playbackSessions.createdAt,
      expiresAt: playbackSessions.expiresAt,
      revokedAt: playbackSessions.revokedAt,
    })
    .from(playbackSessions)
    .where(and(lt(playbackSessions.createdAt, capISO), gt(playbackSessions.expiresAt, startISO)));

  const createdInDay = sessions.filter((s) => s.createdAt >= startISO && s.createdAt < capISO);
  const streamingSessions = createdInDay.length;
  const uniqueViewers = new Set(createdInDay.map((s) => s.accountId)).size;

  const stats = concurrencyStats(sessions, dayStart, capMs);
  const streamingPeak = stats.peak;

  let watchTimeMs = 0;
  for (const s of sessions) {
    const startMs = Math.max(Date.parse(s.createdAt), dayStart);
    const hardEnd = s.revokedAt
      ? Math.min(Date.parse(s.revokedAt), Date.parse(s.expiresAt))
      : Date.parse(s.expiresAt);
    const endMs = Math.min(hardEnd, capMs);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) watchTimeMs += endMs - startMs;
  }
  const watchTimeMinutes = Math.round(watchTimeMs / 60000);

  // ---- Upsert (idempotent by date).
  const metrics = {
    newSubscribers,
    renewedSubscriptions,
    expiredSubscriptions,
    cancelledSubscriptions,
    activeSubscribers,
    revenueGrossMinor,
    revenueDiscountMinor,
    revenueNetMinor,
    revenueRefundMinor,
    transactions,
    streamingSessions,
    uniqueViewers,
    streamingPeak,
    watchTimeMinutes,
    autoRenewEnabled,
    autoRenewPotentialValueMinor,
    autoRenewChurnRisk24h,
    autoRenewChurnRisk3d,
    autoRenewChurnRisk7d,
  };
  const updatedAt = new Date().toISOString();

  await db
    .insert(analyticsDaily)
    .values({ date: dateKey, ...metrics, updatedAt })
    .onConflictDoUpdate({
      target: analyticsDaily.date,
      set: { ...metrics, updatedAt },
    });
}

export interface BackfillResult {
  aggregatedDays: number;
  from: string;
  to: string;
}

export async function aggregateRange(fromKey: string, toKey: string, maxDays = 370): Promise<BackfillResult> {
  const days = eachDay(fromKey, toKey);
  const bounded = days.length > maxDays ? days.slice(days.length - maxDays) : days;
  for (const day of bounded) {
    await aggregateDay(day);
  }
  return {
    aggregatedDays: bounded.length,
    from: bounded[0],
    to: bounded[bounded.length - 1] ?? todayKey(),
  };
}

// Cold-start / deploy-time backfill: fills from the earliest relevant record
// (bounded to maxDays, ending today). Subsequent deploys only fill the gap.
export async function backfillAnalytics(maxDays = 370): Promise<BackfillResult> {
  const today = todayKey();
  const earliest = await earliestRelevantDateKey();
  const existing = await db.all<{ maxd: string | null; cnt: number }>(
    sql`SELECT MAX(date) AS maxd, COUNT(*) AS cnt FROM analytics_daily`
  );
  const existingMax = existing[0]?.maxd ?? null;
  const existingCount = Number(existing[0]?.cnt ?? 0);

  let fromKey: string;
  if (existingCount > 0 && existingMax) {
    const nextAfterMax = dateKeyOf(new Date(Date.parse(existingMax) + 86400000));
    fromKey = nextAfterMax > earliest ? nextAfterMax : earliest;
  } else {
    fromKey = earliest;
  }
  if (fromKey > today) return { aggregatedDays: 0, from: today, to: today };
  return aggregateRange(fromKey, today, maxDays);
}

// Lightweight periodic refresh (last N days + today). Falls back to a full
// backfill when the table is empty.
export async function ensureRecentAnalytics(days = 4): Promise<BackfillResult> {
  const existing = await db.all<{ cnt: number }>(
    sql`SELECT COUNT(*) AS cnt FROM analytics_daily`
  );
  if (Number(existing[0]?.cnt ?? 0) === 0) return backfillAnalytics();
  const today = todayKey();
  const from = dateKeyOf(new Date(Date.parse(today) - (days - 1) * 86400000));
  return aggregateRange(from, today);
}
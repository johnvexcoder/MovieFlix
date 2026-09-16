import { NextRequest } from "next/server";
import { db } from "@/db";
import { 
  accounts, 
  subscriptions, 
  billingOrders,
  playbackSessions,
  analyticsDaily,
  promoCodes,
  promoRedemptions,
  subscriptionPlans
} from "@/db/schema";
import { eq, gt, lt, gte, lte, and, sql, isNull, isNotNull, desc, count, sum } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { concurrencyStats } from "@/lib/concurrency";

interface AnalyticsResponse {
  range: string;
  summary: Record<string, any>;
  comparison: Record<string, any>;
  metrics: Record<string, any>;
  series: Array<{ date: string; value: number }>;
}

// Helper to get date range based on period
function getDateRange(range: string): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  
  switch (range) {
    case "1m":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case "3m":
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case "6m":
      start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      break;
    case "1y":
      start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }
  
  return { start, end: now };
}

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper to group data by day/week/month
function groupByDateRange(
  start: Date, 
  end: Date, 
  range: string
): Array<{ start: Date; end: Date }> {
  const groups: Array<{ start: Date; end: Date }> = [];
  let current = new Date(start);
  
  switch (range) {
    case "1m": // Daily
      while (current < end) {
        const next = new Date(current);
        next.setDate(next.getDate() + 1);
        groups.push({ start: new Date(current), end: new Date(next) });
        current.setDate(current.getDate() + 1);
      }
      break;
    case "3m": // Weekly
    case "6m": // Weekly
      while (current < end) {
        const next = new Date(current);
        next.setDate(next.getDate() + 7);
        groups.push({ start: new Date(current), end: new Date(next) });
        current.setDate(current.getDate() + 7);
      }
      break;
    case "1y": // Monthly
      while (current < end) {
        const next = new Date(current);
        next.setMonth(next.getMonth() + 1);
        groups.push({ start: new Date(current), end: new Date(next) });
        current.setMonth(current.getMonth() + 1);
      }
      break;
  }
  
  return groups;
}

export async function GET(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "subscribers";
    const range = searchParams.get("range") || "1m";
    
    const { start, end } = getDateRange(range);
    const dateGroups = groupByDateRange(start, end, range);
    
    let response: AnalyticsResponse = {
      range,
      summary: {},
      comparison: {},
      metrics: {},
      series: []
    };

    switch (type) {
      case "subscribers":
        response = await getSubscribersAnalytics(dateGroups, range, start, end);
        break;
      case "revenue":
        response = await getRevenueAnalytics(dateGroups, range, start, end);
        break;
      case "expirations":
        response = await getExpirationsAnalytics(dateGroups, range, start, end);
        break;
      case "streaming":
        response = await getStreamingAnalytics(dateGroups, range, start, end);
        break;
      default:
        return errorResponse("Invalid analytics type", 400);
    }

    return successResponse(response);
  } catch (error) {
    console.error("Get analytics error:", error);
    return errorResponse("Internal server error", 500);
  }
}

// Subscribers analytics
async function getSubscribersAnalytics(
  dateGroups: Array<{ start: Date; end: Date }>,
  range: string,
  startDate: Date,
  endDate: Date
): Promise<AnalyticsResponse> {
  // Get current active subscribers
  const [currentResult] = await db
    .select({ count: count() })
    .from(accounts)
    .innerJoin(subscriptions, eq(accounts.id, subscriptions.accountId))
    .where(
      and(
        eq(subscriptions.status, "ACTIVE"),
        eq(subscriptions.isLifetime, false),
        gt(subscriptions.currentPeriodEnd, new Date().toISOString())
      )
    );

  const currentCount = Number(currentResult.count) || 0;
  
  // Get previous period count for comparison
  const prevStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
  const prevEnd = new Date(startDate.getTime());
  
  const [prevResult] = await db
    .select({ count: count() })
    .from(accounts)
    .innerJoin(subscriptions, eq(accounts.id, subscriptions.accountId))
    .where(
      and(
        eq(subscriptions.status, "ACTIVE"),
        eq(subscriptions.isLifetime, false),
        gt(subscriptions.currentPeriodEnd, prevStart.toISOString()),
        lt(subscriptions.currentPeriodEnd, prevEnd.toISOString())
      )
    );

  const prevCount = Number(prevResult.count) || 0;
  const change = prevCount > 0 ? ((currentCount - prevCount) / prevCount) * 100 : 0;
  
  // Get metrics: new, renewed, expired, cancelled in period
  const [newSubscribersResult] = await db
    .select({ count: count() })
    .from(accounts)
    .innerJoin(subscriptions, eq(accounts.id, subscriptions.accountId))
    .where(
      and(
        eq(subscriptions.status, "ACTIVE"),
        eq(subscriptions.isLifetime, false),
        gte(subscriptions.createdAt, startDate.toISOString()),
        lt(subscriptions.createdAt, endDate.toISOString())
      )
    );

  const newSubscribers = Number(newSubscribersResult.count) || 0;
  
  // For simplicity, we'll approximate renewals as subscriptions with updatedAt in period
  // In a real system, you'd have explicit renewal events
  const [renewalsResult] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "ACTIVE"),
        eq(subscriptions.isLifetime, false),
        gte(subscriptions.updatedAt, startDate.toISOString()),
        lt(subscriptions.updatedAt, endDate.toISOString()),
        gt(subscriptions.currentPeriodEnd, new Date().toISOString())
      )
    );

  const renewals = Number(renewalsResult.count) || 0;
  
  // Expired subscriptions in period
  const [expiredResult] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.isLifetime, false),
        lt(subscriptions.currentPeriodEnd, endDate.toISOString()),
        gte(subscriptions.currentPeriodEnd, startDate.toISOString())
      )
    );

  const expired = Number(expiredResult.count) || 0;
  
  // Cancelled subscriptions (cancelAtPeriodEnd = true and expired in period)
  const [cancelledResult] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.cancelAtPeriodEnd, true),
        eq(subscriptions.isLifetime, false),
        lt(subscriptions.currentPeriodEnd, endDate.toISOString()),
        gte(subscriptions.currentPeriodEnd, startDate.toISOString())
      )
    );

  const cancelled = Number(cancelledResult.count) || 0;

  // Auto-renew enabled accounts plus potential renewal value (sum of each
  // account's most recent PAID order amount).
  const autoRenewSubs = await db
    .select({ accountId: subscriptions.accountId })
    .from(subscriptions)
    .where(and(eq(subscriptions.autoRenew, true), eq(subscriptions.status, "ACTIVE")));
  let autoRenewPotentialValueMinor = 0;
  if (autoRenewSubs.length > 0) {
    const paidRows = await db.all<{ account_id: string; final_amount_minor: number; paid_at: string }>(
      sql`SELECT account_id, final_amount_minor, paid_at FROM billing_orders WHERE status = 'PAID'`
    );
    const lastByAccount = new Map<string, { minor: number; paidMs: number }>();
    for (const r of paidRows) {
      const paidMs = Date.parse(r.paid_at);
      const cur = lastByAccount.get(r.account_id);
      if (!cur || paidMs > cur.paidMs) {
        lastByAccount.set(r.account_id, { minor: Number(r.final_amount_minor) || 0, paidMs });
      }
    }
    for (const s of autoRenewSubs) autoRenewPotentialValueMinor += lastByAccount.get(s.accountId)?.minor || 0;
  }
  
  // Build time series data (new subscriptions per period, daily aggregate first)
  const dailySeries = await seriesFromDaily(db, "subscribers", dateGroups);
  const series =
    dailySeries ??
    (await Promise.all(
      dateGroups.map(async (group) => {
        const [result] = await db
          .select({ count: count() })
          .from(accounts)
          .innerJoin(subscriptions, eq(accounts.id, subscriptions.accountId))
          .where(
            and(
              eq(subscriptions.status, "ACTIVE"),
              eq(subscriptions.isLifetime, false),
              gte(subscriptions.createdAt, group.start.toISOString()),
              lt(subscriptions.createdAt, group.end.toISOString())
            )
          );

        return {
          date: formatDate(group.start),
          value: Number(result.count) || 0,
        };
      })
    ));

  return {
    range,
    summary: {
      activeSubscribers: currentCount
    },
    comparison: {
      previous: prevCount,
      change: Math.round(change * 10) / 10,
      percentage: Math.round(change * 10) / 10
    },
    metrics: {
      newSubscribers,
      renewals,
      expired,
      cancelled,
      netChange: newSubscribers + renewals - expired - cancelled,
      autoRenewEnabled: autoRenewSubs.length,
      autoRenewPotentialValueMinor,
    },
    series
  };
}

// Revenue analytics
async function getRevenueAnalytics(
  dateGroups: Array<{ start: Date; end: Date }>,
  range: string,
  startDate: Date,
  endDate: Date
): Promise<AnalyticsResponse> {
  const paidInPeriod = and(
    eq(billingOrders.status, "PAID"),
    gte(billingOrders.paidAt, startDate.toISOString()),
    lt(billingOrders.paidAt, endDate.toISOString())
  );

  // Current-period aggregates. Money is stored in minor units (centavos).
  const [currentResult] = await db
    .select({
      gross: sum(billingOrders.originalAmountMinor),
      discounts: sum(billingOrders.discountAmountMinor),
      net: sum(billingOrders.finalAmountMinor),
      transactions: count(),
    })
    .from(billingOrders)
    .where(paidInPeriod);

  const grossRevenue = Number(currentResult?.gross ?? 0) || 0;
  const discountTotal = Number(currentResult?.discounts ?? 0) || 0;
  const netRevenue = Number(currentResult?.net ?? 0) || 0;
  const transactionCount = Number(currentResult?.transactions ?? 0) || 0;
  const averageTransactionValue = transactionCount > 0 ? netRevenue / transactionCount : 0;

  // Promo-specific discount total.
  const [promoDiscountResult] = await db
    .select({ total: sum(billingOrders.discountAmountMinor) })
    .from(billingOrders)
    .where(and(paidInPeriod, isNotNull(billingOrders.promoId)));
  const promoDiscountTotal = Number(promoDiscountResult?.total ?? 0) || 0;

  // Top plan by net revenue in period.
  const topPlanRows = await db
    .select({
      planName: billingOrders.planNameSnapshot,
      total: sum(billingOrders.finalAmountMinor),
    })
    .from(billingOrders)
    .where(paidInPeriod)
    .groupBy(billingOrders.planNameSnapshot)
    .orderBy(desc(sum(billingOrders.finalAmountMinor)))
    .limit(1);
  const topPlan = topPlanRows.length
    ? { name: topPlanRows[0].planName, net: Number(topPlanRows[0].total ?? 0) || 0 }
    : null;

  // Refunds booked (admin-recorded) within the period.
  const [refundRow] = await db
    .select({ total: sum(billingOrders.refundAmountMinor) })
    .from(billingOrders)
    .where(
      and(
        gte(billingOrders.refundedAt, startDate.toISOString()),
        lt(billingOrders.refundedAt, endDate.toISOString())
      )
    );
  const refunds = Number(refundRow?.total ?? 0) || 0;

  // Previous equivalent period (same length, immediately preceding).
  const prevStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
  const prevEnd = startDate;
  const [prevResult] = await db
    .select({ net: sum(billingOrders.finalAmountMinor) })
    .from(billingOrders)
    .where(
      and(
        eq(billingOrders.status, "PAID"),
        gte(billingOrders.paidAt, prevStart.toISOString()),
        lt(billingOrders.paidAt, prevEnd.toISOString())
      )
    );
  const prevNetRevenue = Number(prevResult?.net ?? 0) || 0;
  const change = prevNetRevenue > 0 ? ((netRevenue - prevNetRevenue) / prevNetRevenue) * 100 : 0;

  // Time series: net revenue per group (from the daily aggregate when available).
  const dailySeries = await seriesFromDaily(db, "revenue", dateGroups);
  const series =
    dailySeries ??
    (await Promise.all(
      dateGroups.map(async (group) => {
        const [result] = await db
          .select({ total: sum(billingOrders.finalAmountMinor) })
          .from(billingOrders)
          .where(
            and(
              eq(billingOrders.status, "PAID"),
              gte(billingOrders.paidAt, group.start.toISOString()),
              lt(billingOrders.paidAt, group.end.toISOString())
            )
          );
        return {
          date: formatDate(group.start),
          value: Number(result?.total ?? 0) || 0,
        };
      })
    ));

  return {
    range,
    summary: {
      grossRevenue,
      netRevenue,
    },
    comparison: {
      previous: prevNetRevenue,
      change: Math.round(change * 10) / 10,
      changeAmount: netRevenue - prevNetRevenue,
    },
    metrics: {
      transactionCount,
      averageTransactionValue,
      refunds,
      discounts: discountTotal,
      promoDiscounts: promoDiscountTotal,
      netRevenue,
      topPlan,
    },
    series,
  };
}

// Expirations analytics
async function getExpirationsAnalytics(
  dateGroups: Array<{ start: Date; end: Date }>,
  range: string,
  startDate: Date,
  endDate: Date
): Promise<AnalyticsResponse> {
  // Get expiring soon count (next 7 days from now)
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  const [expiringSoonResult] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.isLifetime, false),
        gt(subscriptions.currentPeriodEnd, now.toISOString()),
        lte(subscriptions.currentPeriodEnd, sevenDaysLater.toISOString())
      )
    );

  const expiringSoonCount = Number(expiringSoonResult.count) || 0;

  // Real countdown buckets for the expirations panel.
  async function countExpiringWithin(days: number, autoRenewOnly = false): Promise<number> {
    const until = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const [result] = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.isLifetime, false),
          gt(subscriptions.currentPeriodEnd, now.toISOString()),
          lte(subscriptions.currentPeriodEnd, until.toISOString()),
          autoRenewOnly
            ? and(eq(subscriptions.autoRenew, true), eq(subscriptions.cancelAtPeriodEnd, false))
            : undefined
        )
      );
    return Number(result.count) || 0;
  }

  const within24Hours = await countExpiringWithin(1);
  const within3Days = await countExpiringWithin(3);
  const within24HoursAutoRenew = await countExpiringWithin(1, true);
  const within3DaysAutoRenew = await countExpiringWithin(3, true);
  const within7DaysAutoRenew = await countExpiringWithin(7, true);
  
  // Get expired count in period
  const [expiredInPeriodResult] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.isLifetime, false),
        lt(subscriptions.currentPeriodEnd, endDate.toISOString()),
        gte(subscriptions.currentPeriodEnd, startDate.toISOString())
      )
    );

  const expiredInPeriod = Number(expiredInPeriodResult.count) || 0;
  
  // Get renewed count in period (approximated by subscriptions updated and still active)
  const [renewedInPeriodResult] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, "ACTIVE"),
        eq(subscriptions.isLifetime, false),
        gte(subscriptions.updatedAt, startDate.toISOString()),
        lt(subscriptions.updatedAt, endDate.toISOString()),
        gt(subscriptions.currentPeriodEnd, new Date().toISOString())
      )
    );

  const renewedInPeriod = Number(renewedInPeriodResult.count) || 0;
  
  // Build time series data (expirations per period, daily aggregate first)
  const dailySeries = await seriesFromDaily(db, "expirations", dateGroups);
  const series =
    dailySeries ??
    (await Promise.all(
      dateGroups.map(async (group) => {
        const [result] = await db
          .select({ count: count() })
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.isLifetime, false),
              lt(subscriptions.currentPeriodEnd, group.end.toISOString()),
              gte(subscriptions.currentPeriodEnd, group.start.toISOString())
            )
          );
        return {
          date: formatDate(group.start),
          value: Number(result.count) || 0,
        };
      })
    ));

  // Previous equal-length window for the change percentage.
  const prevStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
  const prevEnd = startDate;
  const [prevExpiredResult] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.isLifetime, false),
        lt(subscriptions.currentPeriodEnd, prevEnd.toISOString()),
        gte(subscriptions.currentPeriodEnd, prevStart.toISOString())
      )
    );
  const prevExpired = Number(prevExpiredResult.count) || 0;
  const expChange = prevExpired > 0 ? ((expiredInPeriod - prevExpired) / prevExpired) * 100 : 0;

  return {
    range,
    summary: {
      expiringSoon: expiringSoonCount,
      expiredInPeriod,
      renewedInPeriod
    },
    comparison: {
      previous: prevExpired,
      change: Math.round(expChange * 10) / 10
    },
    metrics: {
      expiringSoon: expiringSoonCount,
      expiredInPeriod,
      renewedInPeriod,
      within24Hours,
      within3Days,
      within7Days: expiringSoonCount,
      within24HoursAutoRenew,
      within3DaysAutoRenew,
      within7DaysAutoRenew,
    },
    series
  };
}

// Time series from the pre-aggregated analytics_daily table. Returns null when
// the table has no rows in the window so callers can fall back to raw scans.
// Rendering kind: subscribers=newSubscribers, revenue=revenueNetMinor,
// expirations=expiredSubscriptions, streaming=streamingPeak (max per bucket).
async function seriesFromDaily(
  dbh: any,
  kind: "subscribers" | "revenue" | "expirations" | "streaming",
  dateGroups: Array<{ start: Date; end: Date }>
): Promise<Array<{ date: string; value: number }> | null> {
  const rows = await dbh.select().from(analyticsDaily);
  if (!rows.length) return null;

  const startMs = dateGroups[0]?.start.getTime();
  const endMs = dateGroups[dateGroups.length - 1]?.end.getTime();
  if (startMs === undefined || endMs === undefined) return [];

  const pick = (r: (typeof rows)[number]): number =>
    kind === "subscribers"
      ? r.newSubscribers
      : kind === "revenue"
      ? r.revenueNetMinor
      : kind === "expirations"
      ? r.expiredSubscriptions
      : r.streamingPeak;

  const isMax = kind === "streaming";
  return dateGroups.map((group) => {
    const gs = group.start.getTime();
    const ge = group.end.getTime();
    let acc = 0;
    if (isMax) acc = -Infinity;
    for (const row of rows) {
      const d0 = Date.parse(row.date);
      const d1 = d0 + 86400000;
      if (d0 < ge && d1 > gs) {
        acc = isMax ? Math.max(acc, pick(row)) : acc + pick(row);
      }
    }
    return { date: formatDate(group.start), value: isMax && acc === -Infinity ? 0 : acc };
  });
}

// Streaming analytics
async function getStreamingAnalytics(
  dateGroups: Array<{ start: Date; end: Date }>,
  range: string,
  startDate: Date,
  endDate: Date
): Promise<AnalyticsResponse> {
  // Get current active streams: sessions with a recent heartbeat (last seen
  // within 2 minutes) so stale sessions are not counted as still streaming.
  const now = new Date();
  const heartbeatCutoff = new Date(now.getTime() - 2 * 60 * 1000).toISOString();
  const [currentResult] = await db
    .select({ 
      count: count(),
      accounts: sql<number>`count(DISTINCT ${playbackSessions.accountId})`
     })
    .from(playbackSessions)
    .where(
      and(
        lt(playbackSessions.createdAt, now.toISOString()),
        gt(playbackSessions.expiresAt, now.toISOString()),
        isNull(playbackSessions.revokedAt),
        gt(playbackSessions.lastSeenAt, heartbeatCutoff)
      )
    );

  const currentCount = Number(currentResult.count) || 0;
  const currentAccounts = Number(currentResult.accounts) || 0;
  
  // Get previous period count for comparison
  const prevStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
  const prevEnd = new Date(startDate.getTime());
  
  const [prevResult] = await db
    .select({ count: count() })
    .from(playbackSessions)
    .where(
      and(
        gt(playbackSessions.expiresAt, prevStart.toISOString()),
        lt(playbackSessions.expiresAt, prevEnd.toISOString()),
        isNull(playbackSessions.revokedAt)
      )
    );

  const prevCount = Number(prevResult.count) || 0;
  const change = prevCount > 0 ? ((currentCount - prevCount) / prevCount) * 100 : 0;
  
  // Get metrics: total sessions, watch time (heartbeat-derived)
  const [sessionsCountResult] = await db
    .select({ count: count() })
    .from(playbackSessions)
    .where(
      and(
        gt(playbackSessions.createdAt, startDate.toISOString()),
        lt(playbackSessions.createdAt, endDate.toISOString())
      )
    );

  const sessionCount = Number(sessionsCountResult.count) || 0;

  // Sessions overlapping the reporting window, clipped to "now". The effective
  // end of a watched session is its last heartbeat when present, otherwise its
  // hard expiry/revocation, always capped at "now".
  const periodEndMs = Math.min(endDate.getTime(), now.getTime());
  const overlappingSessions = await db
    .select({
      accountId: playbackSessions.accountId,
      createdAt: playbackSessions.createdAt,
      expiresAt: playbackSessions.expiresAt,
      revokedAt: playbackSessions.revokedAt,
      lastSeenAt: playbackSessions.lastSeenAt,
    })
    .from(playbackSessions)
    .where(
      and(
        lt(playbackSessions.createdAt, new Date(periodEndMs).toISOString()),
        gt(playbackSessions.expiresAt, startDate.toISOString())
      )
    );

  const startStr = startDate.toISOString();
  const periodEndStr = new Date(periodEndMs).toISOString();
  const uniqueViewers = new Set(
    overlappingSessions
      .filter((s) => s.createdAt >= startStr && s.createdAt < periodEndStr)
      .map((s) => s.accountId)
  ).size;

  let watchTimeMs = 0;
  for (const s of overlappingSessions) {
    const startMs = Math.max(Date.parse(s.createdAt), startDate.getTime());
    const hardEnd = s.revokedAt
      ? Math.min(Date.parse(s.revokedAt), Date.parse(s.expiresAt))
      : Date.parse(s.expiresAt);
    const heartbeatEnd = s.lastSeenAt ? Date.parse(s.lastSeenAt) : hardEnd;
    const endMs = Math.min(heartbeatEnd, hardEnd, periodEndMs);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
      watchTimeMs += endMs - startMs;
    }
  }
  const watchTimeMinutes = Math.round(watchTimeMs / 60000);

  const concurrency = concurrencyStats(overlappingSessions, startDate.getTime(), periodEndMs);

  // Build time series: peak concurrent streams per group (daily aggregate first).
  const dailySeries = await seriesFromDaily(db, "streaming", dateGroups);
  const series =
    dailySeries ??
    (await Promise.all(
      dateGroups.map(async (group) => {
        const groupEnd = Math.min(group.end.getTime(), now.getTime());
        const stats = concurrencyStats(overlappingSessions, group.start.getTime(), groupEnd);
        return {
          date: formatDate(group.start),
          value: stats.peak
        };
      })
    ));

  return {
    range,
    summary: {
      currentlyStreaming: currentCount,
      accountsWatching: currentAccounts
    },
    comparison: {
      previous: prevCount,
      change: Math.round(change * 10) / 10
    },
    metrics: {
      streamingSessions: sessionCount,
      watchTime: watchTimeMinutes,
      averageConcurrentStreams: Math.round(concurrency.average * 10) / 10,
      peakConcurrentStreams: concurrency.peak,
      uniqueViewers,
    },
    series
  };
}
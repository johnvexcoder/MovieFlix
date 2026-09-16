import { NextRequest } from "next/server";
import { db } from "@/db";
import { 
  accounts, 
  subscriptions, 
  billingOrders,
  playbackSessions,
  promoCodes,
  promoRedemptions,
  subscriptionPlans
} from "@/db/schema";
import { eq, gt, lt, gte, lte, and, sql, isNull, count, sum, avg } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";

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
        response = await getSubscribersAnalytics(db, dateGroups, range, start, end);
        break;
      case "revenue":
        response = await getRevenueAnalytics(db, dateGroups, range, start, end);
        break;
      case "expirations":
        response = await getExpirationsAnalytics(db, dateGroups, range, start, end);
        break;
      case "streaming":
        response = await getStreamingAnalytics(db, dateGroups, range, start, end);
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
  db: any,
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
  
  // Build time series data (new subscriptions per period)
  const series = await Promise.all(
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
        value: Number(result.count) || 0
      };
    })
  );

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
      netChange: newSubscribers + renewals - expired - cancelled
    },
    series
  };
}

// Revenue analytics
async function getRevenueAnalytics(
  db: any,
  dateGroups: Array<{ start: Date; end: Date }>,
  range: string,
  startDate: Date,
  endDate: Date
): Promise<AnalyticsResponse> {
  // Get current period revenue
  const [currentResult] = await db
    .select({ total: sum(billingOrders.finalAmountMinor) })
    .from(billingOrders)
    .where(
      and(
        eq(billingOrders.status, "SUCCEEDED"),
        gte(billingOrders.paidAt, startDate.toISOString()),
        lt(billingOrders.paidAt, endDate.toISOString())
      )
    );

  const currentTotal = Number(currentResult.total ?? 0) || 0;
  
  // Get previous period revenue for comparison
  const prevStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
  const prevEnd = new Date(startDate.getTime());
  
  const [prevResult] = await db
    .select({ total: sum(billingOrders.finalAmountMinor) })
    .from(billingOrders)
    .where(
      and(
        eq(billingOrders.status, "SUCCEEDED"),
        gte(billingOrders.paidAt, prevStart.toISOString()),
        lt(billingOrders.paidAt, prevEnd.toISOString())
      )
    );

  const prevTotal = Number(prevResult.total ?? 0) || 0;
  const change = prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0;
  
  // Get metrics: transaction count, average value, refunds, discounts
  const [txCountResult] = await db
    .select({ count: count() })
    .from(billingOrders)
    .where(
      and(
        eq(billingOrders.status, "SUCCEEDED"),
        gte(billingOrders.paidAt, startDate.toISOString()),
        lt(billingOrders.paidAt, endDate.toISOString())
      )
    );

  const transactionCount = Number(txCountResult.count) || 0;
  const averageTransactionValue = transactionCount > 0 ? currentTotal / transactionCount : 0;
  
  // For refunds and discounts, we'd need to look at billing_events or similar
  // For now, we'll use placeholder values since the schema doesn't explicitly track these separately
  const refunds = 0; // Would need to query billing_events for refunds
  const discounts = 0; // Would need to calculate from original vs final amounts
  
  // Build time series data (daily revenue)
  const series = await Promise.all(
    dateGroups.map(async (group) => {
      const [result] = await db
        .select({ total: sum(billingOrders.finalAmountMinor) })
        .from(billingOrders)
        .where(
          and(
            eq(billingOrders.status, "SUCCEEDED"),
            gte(billingOrders.paidAt, group.start.toISOString()),
            lt(billingOrders.paidAt, group.end.toISOString())
          )
        );
      
      return {
        date: formatDate(group.start),
        value: Number(result.total ?? 0) || 0
      };
    })
  );

  return {
    range,
    summary: {
      grossRevenue: currentTotal, // Assuming all successful payments are gross
      netRevenue: currentTotal - refunds - discounts
    },
    comparison: {
      previous: prevTotal,
      change: Math.round(change * 10) / 10
    },
    metrics: {
      transactionCount,
      averageTransactionValue,
      refunds,
      discounts,
      netRevenue: currentTotal - refunds - discounts
    },
    series
  };
}

// Expirations analytics
async function getExpirationsAnalytics(
  db: any,
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
  
  // Build time series data (expirations per period)
  const series = await Promise.all(
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
        value: Number(result.count) || 0
      };
    })
  );

  return {
    range,
    summary: {
      expiringSoon: expiringSoonCount,
      expiredInPeriod,
      renewedInPeriod
    },
    comparison: {
      previous: expiredInPeriod, // Simplified
      change: 0
    },
    metrics: {
      expiringSoon: expiringSoonCount,
      expiredInPeriod,
      renewedInPeriod
    },
    series
  };
}

// Streaming analytics
async function getStreamingAnalytics(
  db: any,
  dateGroups: Array<{ start: Date; end: Date }>,
  range: string,
  startDate: Date,
  endDate: Date
): Promise<AnalyticsResponse> {
  // Get current active streams
  const now = new Date();
  const [currentResult] = await db
    .select({ 
      count: count(),
      accounts: sql<number>`count(DISTINCT ${playbackSessions.accountId})`
     })
    .from(playbackSessions)
    .where(
      and(
        gt(playbackSessions.expiresAt, now.toISOString()),
        isNull(playbackSessions.revokedAt)
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
  
  // Get metrics: total sessions, watch time (approximated)
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
  
  // For watch time, we'd need to look at watchHistory or similar
  // For now, placeholder
  const watchTimeMinutes = 0; // Would need to calculate from actual watch history
  
  // Build time series data (daily peak concurrent streams - simplified)
  const series = await Promise.all(
    dateGroups.map(async (group) => {
      const [result] = await db
        .select({ count: count() })
        .from(playbackSessions)
        .where(
          and(
            gt(playbackSessions.expiresAt, group.start.toISOString()),
            lt(playbackSessions.expiresAt, group.end.toISOString()),
            isNull(playbackSessions.revokedAt)
          )
        );
      
      return {
        date: formatDate(group.start),
        value: Number(result.count) || 0
      };
    })
  );

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
      averageConcurrentStreams: currentCount // Simplified
    },
    series
  };
}
import { NextRequest } from "next/server";
import { db } from "@/db";
import { 
  accounts, 
  subscriptions, 
  billingOrders,
  playbackSessions,
  profiles
} from "@/db/schema";
import { eq, gt, lt, gte, lte, and, sql, isNull, count, sum, avg } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";

interface OverviewResponse {
  activeSubscribers: {
    value: number;
    change: number; // percentage change
  };
  monthlyRevenue: {
    value: number; // in PHP minor units (cents)
    change: number; // percentage change
  };
  expiringSoon: {
    value: number;
    within48Hours: number;
  };
  streamingNow: {
    value: number;
    accounts: number;
    peakToday: number;
  };
}

// Helper to get start of current month
function getStartOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// Helper to get start of previous month
function getStartOfPreviousMonth(): Date {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
}

// Helper to get end of previous month
function getEndOfPreviousMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 0); // Last day of previous month
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

    const now = new Date();
    const startOfMonth = getStartOfMonth();
    const startOfPrevMonth = getStartOfPreviousMonth();
    const endOfPrevMonth = getEndOfPreviousMonth();

    // Active Subscribers: accounts with active non-lifetime subscriptions
    const [activeSubscribersResult] = await db
      .select({ count: count() })
      .from(accounts)
      .innerJoin(subscriptions, eq(accounts.id, subscriptions.accountId))
      .where(
        and(
          eq(subscriptions.status, "ACTIVE"),
          eq(subscriptions.isLifetime, false),
          gt(subscriptions.currentPeriodEnd, now.toISOString())
        )
      );

    const activeSubscribersCount = Number(activeSubscribersResult.count) || 0;

    // Previous month active subscribers for change calculation
    const [prevActiveSubscribersResult] = await db
      .select({ count: count() })
      .from(accounts)
      .innerJoin(subscriptions, eq(accounts.id, subscriptions.accountId))
      .where(
        and(
          eq(subscriptions.status, "ACTIVE"),
          eq(subscriptions.isLifetime, false),
          gt(subscriptions.currentPeriodEnd, startOfPrevMonth.toISOString()),
          lt(subscriptions.currentPeriodEnd, now.toISOString()) // Ended in prev month
        )
      );

    const prevActiveSubscribersCount = Number(prevActiveSubscribersResult.count) || 0;
    const activeSubscribersChange = prevActiveSubscribersCount > 0 
      ? ((activeSubscribersCount - prevActiveSubscribersCount) / prevActiveSubscribersCount) * 100
      : 0;

    // Monthly Revenue: sum of finalAmountMinor from successful payments in current month
    const [monthlyRevenueResult] = await db
      .select({ total: sum(billingOrders.finalAmountMinor) })
      .from(billingOrders)
      .where(
        and(
          eq(billingOrders.status, "SUCCEEDED"),
          gte(billingOrders.paidAt, startOfMonth.toISOString()),
          lt(billingOrders.paidAt, now.toISOString())
        )
      );

    const monthlyRevenue = Number(monthlyRevenueResult.total ?? 0) || 0;

    // Previous month revenue for change calculation
    const [prevMonthlyRevenueResult] = await db
      .select({ total: sum(billingOrders.finalAmountMinor) })
      .from(billingOrders)
      .where(
        and(
          eq(billingOrders.status, "SUCCEEDED"),
          gte(billingOrders.paidAt, startOfPrevMonth.toISOString()),
          lt(billingOrders.paidAt, endOfPrevMonth.toISOString())
        )
      );

    const prevMonthlyRevenue = Number(prevMonthlyRevenueResult.total ?? 0) || 0;
    const monthlyRevenueChange = prevMonthlyRevenue > 0
      ? ((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100
      : 0;

    // Expiring Soon: subscriptions expiring within next 7 days (non-lifetime)
    const [expiringSoonResult] = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.isLifetime, false),
          gt(subscriptions.currentPeriodEnd, now.toISOString()),
          lte(
            subscriptions.currentPeriodEnd,
            new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
          )
        )
      );

    const expiringSoonCount = Number(expiringSoonResult.count) || 0;

    // Expiring within 48 hours
    const [expiringSoon48hResult] = await db
      .select({ count: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.isLifetime, false),
          gt(subscriptions.currentPeriodEnd, now.toISOString()),
          lte(
            subscriptions.currentPeriodEnd,
            new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
          )
        )
      );

    const expiringSoon48hCount = Number(expiringSoon48hResult.count) || 0;

    // Streaming Now: count of active playback sessions (not expired/revoked)
    const [streamingNowResult] = await db
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

    const streamingNowCount = Number(streamingNowResult.count) || 0;
    const streamingNowAccounts = Number(streamingNowResult.accounts) || 0;

    // Peak today: need to calculate from historical data or approximate
    // For now, we'll use current count as peak today (can be improved with proper tracking)
    const peakToday = streamingNowCount; // Placeholder - should be calculated from historical data

    const response: OverviewResponse = {
      activeSubscribers: {
        value: activeSubscribersCount,
        change: Math.round(activeSubscribersChange * 10) / 10, // Round to 1 decimal
      },
      monthlyRevenue: {
        value: monthlyRevenue,
        change: Math.round(monthlyRevenueChange * 10) / 10, // Round to 1 decimal
      },
      expiringSoon: {
        value: expiringSoonCount,
        within48Hours: expiringSoon48hCount,
      },
      streamingNow: {
        value: streamingNowCount,
        accounts: streamingNowAccounts,
        peakToday,
      },
    };

    return successResponse(response);
  } catch (error) {
    console.error("Get analytics overview error:", error);
    return errorResponse("Internal server error", 500);
  }
}
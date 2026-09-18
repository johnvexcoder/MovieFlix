import { and, eq, inArray, isNull, gt, lt } from "drizzle-orm";
import { db } from "@/db";
import { accounts, subscriptions, subscriptionPlans, playbackSessions } from "@/db/schema";

/**
 * Broadcast recipient targeting.
 *
 * The admin can address one of several audiences, each resolved server-side
 * from real account / subscription / streaming data (never hardcoded labels):
 *
 *   all        – every account
 *   ids        – an explicit list of account ids (multi-select)
 *   plan       – accounts on any of the given subscription plans
 *   lifetime   – accounts with no expiration / a lifetime subscription
 *   limited    – accounts that WILL expire (finite subscription)
 *   expiring   – accounts whose expiration falls within a window (hours)
 *   active     – accounts currently streaming (fresh playback heartbeat)
 *   offline    – accounts not currently streaming
 *
 * Returns { ids, count, sample } where sample is a small list of {username,
 * email} used only for a preview and never logged in bulk.
 */
export type BroadcastTargetSpec =
  | { mode: "all" }
  | { mode: "ids"; ids: string[] }
  | { mode: "plan"; planIds: string[] }
  | { mode: "lifetime" }
  | { mode: "limited" }
  | { mode: "expiring"; windowHours: number }
  | { mode: "active" }
  | { mode: "offline" };

const HEARTBEAT_CUTOFF_MS = 2 * 60 * 1000;

export async function resolveBroadcastTarget(
  spec: BroadcastTargetSpec
): Promise<{ ids: string[]; count: number }> {
  const now = new Date();
  const nowISO = now.toISOString();

  // Live streaming accounts (fresh heartbeat, not ended/expired).
  let streamingAccounts: Set<string> | null = null;
  const needsStreaming =
    spec.mode === "active" || spec.mode === "offline";
  if (needsStreaming) {
    const rows = await db
      .select({ accountId: playbackSessions.accountId })
      .from(playbackSessions)
      .where(and(
        isNull(playbackSessions.endedAt),
        isNull(playbackSessions.revokedAt),
        gt(playbackSessions.lastSeenAt, new Date(Date.now() - HEARTBEAT_CUTOFF_MS).toISOString()),
        gt(playbackSessions.expiresAt, nowISO),
      ));
    streamingAccounts = new Set(rows.map((r) => r.accountId));
  }

  let ids: string[] = [];

  if (spec.mode === "all") {
    const rows = await db.select({ id: accounts.id }).from(accounts);
    ids = rows.map((r) => r.id);
  } else if (spec.mode === "ids") {
    ids = Array.from(new Set(spec.ids.filter(Boolean)));
  } else if (spec.mode === "plan") {
    const planIds = Array.from(new Set(spec.planIds.filter(Boolean)));
    const rows = await db
      .select({ accountId: subscriptions.accountId })
      .from(subscriptions)
      .where(inArray(subscriptions.planId, planIds));
    ids = rows.map((r) => r.accountId);
  } else if (spec.mode === "lifetime") {
    // Accounts with no expiration date OR an explicit lifetime subscription.
    const lifetimeSubs = await db
      .select({ accountId: subscriptions.accountId })
      .from(subscriptions)
      .where(eq(subscriptions.isLifetime, true));
    const lifetimeIds = new Set(lifetimeSubs.map((r) => r.accountId));
    const all = await db
      .select({ id: accounts.id, expiresAt: accounts.expiresAt })
      .from(accounts);
    ids = all.filter((a) => !a.expiresAt || lifetimeIds.has(a.id)).map((a) => a.id);
  } else if (spec.mode === "limited") {
    const all = await db
      .select({ id: accounts.id, expiresAt: accounts.expiresAt })
      .from(accounts);
    ids = all.filter((a) => a.expiresAt).map((a) => a.id);
  } else if (spec.mode === "expiring") {
    const windowMs = (Number(spec.windowHours) || 24) * 60 * 60 * 1000;
    const cutoffISO = new Date(now.getTime() + windowMs).toISOString();
    const rows = await db
      .select({ id: accounts.id, expiresAt: accounts.expiresAt })
      .from(accounts)
      .where(and(gt(accounts.expiresAt, nowISO), lt(accounts.expiresAt, cutoffISO)));
    ids = rows.map((r) => r.id);
  } else if (spec.mode === "active") {
    ids = Array.from(streamingAccounts || new Set<string>());
  } else if (spec.mode === "offline") {
    const all = await db.select({ id: accounts.id }).from(accounts);
    ids = all.filter((a) => !streamingAccounts?.has(a.id)).map((a) => a.id);
  }

  return { ids: Array.from(new Set(ids)), count: new Set(ids).size };
}

/** All active subscription plans (for the "On Plan" multi-select). */
export async function listActivePlans() {
  return db
    .select({ id: subscriptionPlans.id, name: subscriptionPlans.name, isLifetime: subscriptionPlans.isLifetime })
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.sortOrder);
}
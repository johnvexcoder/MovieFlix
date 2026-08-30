import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    redis.on("error", (error) => {
      console.error("Redis connection error:", error);
    });

    redis.on("connect", () => {
      console.log("Redis connected");
    });
  }

  return redis;
}

export async function setSession(
  sessionId: string,
  data: Record<string, unknown>,
  expirySeconds: number = 1800
): Promise<void> {
  const client = getRedisClient();
  await client.setex(
    `session:${sessionId}`,
    expirySeconds,
    JSON.stringify(data)
  );
}

export async function getSession(
  sessionId: string
): Promise<Record<string, unknown> | null> {
  const client = getRedisClient();
  const data = await client.get(`session:${sessionId}`);
  return data ? JSON.parse(data) : null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const client = getRedisClient();
  await client.del(`session:${sessionId}`);
}

export async function setTokenVersion(
  profileId: string,
  version: number
): Promise<void> {
  const client = getRedisClient();
  await client.set(`token_version:${profileId}`, version.toString());
}

export async function getTokenVersion(profileId: string): Promise<number> {
  const client = getRedisClient();
  const version = await client.get(`token_version:${profileId}`);
  return version ? parseInt(version, 10) : 1;
}

export async function incrementTokenVersion(
  profileId: string
): Promise<number> {
  const client = getRedisClient();
  return client.incr(`token_version:${profileId}`);
}

/**
 * Revoke a token version for a profile while guaranteeing the new version can
 * never collide with an already-issued token.
 *
 * The naive `incr` (from a missing key) would start at 1 again, which is the
 * same value tokens signed at the very first issuance used, leaving them valid.
 * Instead we explicitly initialise to 2 when no version exists, so every
 * previously-issued token (which was signed at a version <= 1) becomes invalid.
 */
export async function revokeTokenVersion(profileId: string): Promise<number> {
  const client = getRedisClient();
  const key = `token_version:${profileId}`;
  const exists = await client.exists(key);
  if (exists === 0) {
    await client.set(key, "2");
    return 2;
  }
  return client.incr(key);
}

export async function setRateLimit(
  key: string,
  windowMs: number,
  maxRequests: number
): Promise<{ allowed: boolean; remaining: number }> {
  const client = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowMs;

  const multi = client.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zadd(key, now.toString(), now.toString());
  multi.zcard(key);
  multi.expire(key, Math.ceil(windowMs / 1000));

  const results = await multi.exec();
  const count = (results?.[2]?.[1] as number) || 0;

  return {
    allowed: count <= maxRequests,
    remaining: Math.max(0, maxRequests - count),
  };
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/**
 * Active-session tracking. Sessions are stored in a hash keyed by profile:
 *
 *   active_sessions:<profileId> -> { <sessionId>: JSON {...sessionData} }
 *
 * Each profile allows at most ONE active session at a time (enforced by the
 * auth routes). The whole hash expires after `expirySeconds` of inactivity
 * (idle timeout), which the proxy refreshes via `touchActiveSession`.
 */

export interface ActiveSession {
  sessionId: string;
  createdAt: number;
  lastActive: number;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
}

export async function setActiveSession(
  profileId: string,
  sessionId: string,
  metadata: Record<string, unknown> = {},
  expirySeconds: number = 30 * 60
): Promise<void> {
  try {
    const client = getRedisClient();
    const key = `active_sessions:${profileId}`;
    const now = Date.now();
    const sessionData = JSON.stringify({
      sessionId,
      createdAt: now,
      lastActive: now,
      ...metadata,
    });
    await client.hset(key, sessionId, sessionData);
    await client.expire(key, expirySeconds);
  } catch {
    // fail open: if Redis is down, allow the session to proceed
  }
}

/**
 * Returns the active sessions for a profile. Returns `null` when Redis is
 * unavailable (callers fail open rather than locking everyone out), `[]` when
 * Redis is reachable but no session exists.
 */
export async function getActiveSessions(profileId: string): Promise<ActiveSession[] | null> {
  try {
    const client = getRedisClient();
    const sessions = await client.hgetall(`active_sessions:${profileId}`);
    return Object.values(sessions).map((data) => {
      try {
        return JSON.parse(data) as ActiveSession;
      } catch {
        return null;
      }
    }).filter(Boolean) as ActiveSession[];
  } catch {
    return null;
  }
}

export async function removeActiveSession(profileId: string, sessionId: string): Promise<void> {
  try {
    const client = getRedisClient();
    await client.hdel(`active_sessions:${profileId}`, sessionId);
  } catch {
    // redis unavailable — in-memory enforcement still protects new logins
  }
}

/**
 * Refresh the "last seen" timestamp (throttled to once/60s) and slide the idle
 * TTL for an active session.
 */
export async function touchActiveSession(
  profileId: string,
  sessionId: string,
  expirySeconds: number = 30 * 60
): Promise<void> {
  try {
    const client = getRedisClient();
    const key = `active_sessions:${profileId}`;
    const raw = await client.hget(key, sessionId);
    if (!raw) return;
    const session = JSON.parse(raw) as ActiveSession;
    if (session.lastActive && Date.now() - session.lastActive < 60_000) return;
    session.lastActive = Date.now();
    await client.hset(key, sessionId, JSON.stringify(session));
    await client.expire(key, expirySeconds);
  } catch {
    // noop
  }
}

/**
 * Collect every active session across the given profiles (account-wide count).
 */
export async function getAccountActiveSessions(
  profileIds: string[]
): Promise<Array<ActiveSession & { profileId: string }>> {
  const out: Array<ActiveSession & { profileId: string }> = [];
  for (const pid of profileIds) {
    const sessions = await getActiveSessions(pid);
    if (!sessions) continue; // redis unavailable -> fail open
    for (const s of sessions) {
      out.push({ ...s, profileId: pid });
    }
  }
  return out;
}

/**
 * Remove all sessions belonging to a given device across the account's
 * profiles. Used when the same device logs in again (re-login, profile switch)
 * so it replaces its own older sessions instead of double-counting them.
 */
export async function removeSessionsByDevice(
  profileIds: string[],
  deviceId: string,
  excludeSessionId?: string
): Promise<string[]> {
  const removed: string[] = [];
  for (const pid of profileIds) {
    const sessions = await getActiveSessions(pid);
    if (!sessions) continue; // redis unavailable -> fail open
    for (const s of sessions) {
      if (s.deviceId === deviceId && s.sessionId !== excludeSessionId) {
        await removeActiveSession(pid, s.sessionId);
        removed.push(s.sessionId);
      }
    }
  }
  return removed;
}

/**
 * Get the current session ID from a refresh token (if available)
 */
export function extractSessionIdFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload.sessionId || null;
  } catch {
    return null;
  }
}

/**
 * PIN brute-force protection.
 *
 * State is keyed by PROFILE (never by IP), so a shared egress IP can never
 * lock a profile out and a mistake on one profile never affects another. A
 * legitimate user gets effectively unlimited attempts between cooldowns;
 * escalating backoff only kicks in after 5+ CONSECUTIVE failures, and any
 * correct PIN clears the counter immediately.
 */

const PIN_FAIL_TTL_SECONDS = 15 * 60;

export interface PinFailures {
  count: number;
  lockUntil: number;
}

export async function getPinFailures(profileId: string): Promise<PinFailures | null> {
  try {
    const raw = await getRedisClient().get(`pin_fail:${profileId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PinFailures>;
    return {
      count: Number(parsed.count) || 0,
      lockUntil: Number(parsed.lockUntil) || 0,
    };
  } catch {
    return null; // redis unavailable -> fail open (no lockout)
  }
}

function nextPinLockUntil(count: number): number {
  if (count >= 12) return Date.now() + 5 * 60 * 1000;
  if (count >= 8) return Date.now() + 60 * 1000;
  if (count >= 5) return Date.now() + 30 * 1000;
  return 0;
}

/**
 * Record one failed PIN attempt. Returns the lock-until timestamp (0 = not
 * locked yet). The counter expires after `PIN_FAIL_TTL_SECONDS` of inactivity
 * so old failures never translate into a permanent lockout.
 */
export async function recordPinFailure(profileId: string): Promise<number> {
  try {
    const key = `pin_fail:${profileId}`;
    const prev = await getPinFailures(profileId);
    const count = (prev?.count || 0) + 1;
    const lockUntil = nextPinLockUntil(count);
    await getRedisClient().setex(key, PIN_FAIL_TTL_SECONDS, JSON.stringify({ count, lockUntil }));
    return lockUntil;
  } catch {
    return 0;
  }
}

export async function clearPinFailures(profileId: string): Promise<void> {
  try {
    await getRedisClient().del(`pin_fail:${profileId}`);
  } catch {
    // noop
  }
}

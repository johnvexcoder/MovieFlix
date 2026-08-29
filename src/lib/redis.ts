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
 * Track active sessions per profile to enforce single-session policy
 */
export async function setActiveSession(
  profileId: string,
  sessionId: string,
  metadata: Record<string, unknown> = {},
  expirySeconds: number = 7 * 24 * 60 * 60
): Promise<void> {
  const client = getRedisClient();
  const key = `active_sessions:${profileId}`;
  const sessionData = JSON.stringify({
    sessionId,
    createdAt: Date.now(),
    ...metadata,
  });
  await client.hset(key, sessionId, sessionData);
  await client.expire(key, expirySeconds);
}

export async function getActiveSessions(profileId: string): Promise<
  Array<{ sessionId: string; createdAt: number; metadata: Record<string, unknown> }>
> {
  const client = getRedisClient();
  const sessions = await client.hgetall(`active_sessions:${profileId}`);
  return Object.entries(sessions).map(([sessionId, data]) => {
    const parsed = JSON.parse(data);
    return { sessionId, createdAt: parsed.createdAt, metadata: parsed };
  });
}

export async function removeActiveSession(profileId: string, sessionId: string): Promise<void> {
  const client = getRedisClient();
  await client.hdel(`active_sessions:${profileId}`, sessionId);
}

export async function revokeAllSessionsExcept(profileId: string, keepSessionId: string): Promise<number> {
  const client = getRedisClient();
  const key = `active_sessions:${profileId}`;
  const sessions = await client.hkeys(key);
  const toRemove = sessions.filter((id) => id !== keepSessionId);
  if (toRemove.length > 0) {
    await client.hdel(key, ...toRemove);
  }
  return toRemove.length;
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

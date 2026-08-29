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

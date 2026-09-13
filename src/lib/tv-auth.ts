import { getRedisClient } from "@/lib/redis";
import { v4 as uuidv4 } from "uuid";
import { randomInt } from "node:crypto";
import { TV_CODE_CHARSET, TV_CODE_LENGTH, TV_CODE_RE } from "@/lib/tv-code";

/**
 * Smart TV QR login challenges.
 *
 * A challenge is a short-lived code stored in Redis. The TV creates it
 * (`POST /api/auth/tv/qr`), renders `qrUrl` as a QR code and polls its status.
 * The phone opens the approval URL and, once authenticated, approves the code
 * (`POST /api/auth/tv/approve`), stamping it with the account + a one-time
 * claim token. The TV then claims it (`POST /api/auth/tv/claim`) and receives
 * a normal account session (cookies) in return; claiming consumes the code.
 *
 * Lifecycle: awaiting_approval -> approved (with claimToken) -> claimed/deleted.
 */

const TV_QR_PREFIX = "tv:qr:";
const TV_QR_TTL_SECONDS = 300; // 5 minutes

export { TV_CODE_CHARSET, TV_CODE_LENGTH, TV_CODE_RE };

export type TvQrChallengeStatus = "awaiting_approval" | "approved";

export interface TvQrChallenge {
  code: string;
  status: TvQrChallengeStatus;
  createdAt: number;
  expiresAt: number;
  accountId?: string;
  claimToken?: string;
}

function randomCode(): string {
  let out = "";
  for (let i = 0; i < TV_CODE_LENGTH; i += 1) {
    // Authentication challenges must use a cryptographically secure source.
    out += TV_CODE_CHARSET[randomInt(TV_CODE_CHARSET.length)];
  }
  return out;
}

function challengeKey(code: string): string {
  return `${TV_QR_PREFIX}${code}`;
}

// ——— Process-local fallback ———
// All challenge operations prefer Redis (shared, multi-instance) but fall back
// to an in-memory Map when Redis is unreachable, so a single dev/standalone
// server keeps working (same fail-open philosophy as the rate limiter and
// active-session tracking elsewhere in this codebase).
const memChallenges = new Map<string, TvQrChallenge>();

function memPrune(): void {
  const now = Date.now();
  if (memChallenges.size === 0) return;
  for (const [key, value] of memChallenges) {
    if (value.expiresAt <= now) memChallenges.delete(key);
  }
}

export async function createTvQrChallenge(): Promise<TvQrChallenge> {
  const now = Date.now();
  const client = getRedisClient();
  let code = randomCode();
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if ((await client.exists(challengeKey(code))) === 0) break;
      code = randomCode();
    }
    const challenge: TvQrChallenge = {
      code,
      status: "awaiting_approval",
      createdAt: now,
      expiresAt: now + TV_QR_TTL_SECONDS * 1000,
    };
    await client.setex(challengeKey(code), TV_QR_TTL_SECONDS, JSON.stringify(challenge));
    return challenge;
  } catch {
    // Redis unavailable — store in memory for this process.
    memPrune();
    const challenge: TvQrChallenge = {
      code,
      status: "awaiting_approval",
      createdAt: now,
      expiresAt: now + TV_QR_TTL_SECONDS * 1000,
    };
    memChallenges.set(code, challenge);
    return challenge;
  }
}

export async function getTvQrChallenge(code: string): Promise<TvQrChallenge | null> {
  try {
    const raw = await getRedisClient().get(challengeKey(code));
    if (raw) return JSON.parse(raw) as TvQrChallenge;
  } catch {
    // Redis unavailable — check the in-memory store below.
  }

  memPrune();
  const challenge = memChallenges.get(code);
  if (!challenge) return null;
  if (challenge.expiresAt <= Date.now()) {
    memChallenges.delete(code);
    return null;
  }
  return challenge;
}

/**
 * Mark a challenge as approved on behalf of `accountId`. Returns the updated
 * challenge (now carrying a one-time claimToken) or null when the code is
 * missing/expired/already used.
 */
export async function approveTvQrChallenge(
  code: string,
  accountId: string
): Promise<TvQrChallenge | null> {
  const key = challengeKey(code);
  try {
    // GETDEL makes the one-time exchange atomic across concurrent app workers.
    // Without it, two simultaneous claims could both read the same challenge
    // before either deleted it and both receive a session.
    const raw = await getRedisClient().getdel(key);
    if (raw) {
      const challenge = JSON.parse(raw) as TvQrChallenge;
      if (challenge.status !== "awaiting_approval") return null;
      challenge.status = "approved";
      challenge.accountId = accountId;
      challenge.claimToken = uuidv4();
      await getRedisClient().setex(key, TV_QR_TTL_SECONDS, JSON.stringify(challenge));
      return challenge;
    }
  } catch {
    // Redis unavailable — fall through to the in-memory store.
  }

  memPrune();
  const challenge = memChallenges.get(code);
  if (!challenge) return null;
  if (challenge.expiresAt <= Date.now()) {
    memChallenges.delete(code);
    return null;
  }
  if (challenge.status !== "awaiting_approval") return null;
  challenge.status = "approved";
  challenge.accountId = accountId;
  challenge.claimToken = uuidv4();
  return challenge;
}

/**
 * Exchange a code + claimToken for the approving account. One-time use: the
 * challenge is deleted on success so a stolen claim token cannot be replayed.
 */
export async function claimTvQrChallenge(
  code: string,
  claimToken: string
): Promise<{ ok: true; accountId: string } | { ok: false }> {
  const key = challengeKey(code);
  try {
    // Validate and delete in one Redis operation. A wrong token does not let
    // an attacker cancel the TV's valid challenge, while concurrent valid
    // claims cannot both succeed.
    const accountId = await getRedisClient().eval(
      "local raw=redis.call('GET',KEYS[1]); if not raw then return false end; " +
        "local c=cjson.decode(raw); if c.status~='approved' or c.claimToken~=ARGV[1] or not c.accountId then return false end; " +
        "redis.call('DEL',KEYS[1]); return c.accountId",
      1,
      key,
      claimToken
    );
    if (typeof accountId === "string" && accountId) return { ok: true, accountId };
    return { ok: false };
  } catch {
    // Redis unavailable — fall through to the in-memory store.
  }

  const challenge = memChallenges.get(code);
  if (!challenge) return { ok: false };
  if (
    challenge.status !== "approved" ||
    !challenge.claimToken ||
    challenge.claimToken !== claimToken ||
    !challenge.accountId
  ) {
    return { ok: false };
  }
  memChallenges.delete(code);
  return { ok: true, accountId: challenge.accountId };
}

export async function invalidateTvQrChallenge(code: string): Promise<void> {
  try {
    await getRedisClient().del(challengeKey(code));
  } catch {
    // noop
  }
  memChallenges.delete(code);
}

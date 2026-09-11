import { getRedisClient } from "@/lib/redis";
import { v4 as uuidv4 } from "uuid";
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
const TV_QR_TTL_SECONDS = 600; // 10 minutes

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
    out += TV_CODE_CHARSET[Math.floor(Math.random() * TV_CODE_CHARSET.length)];
  }
  return out;
}

function challengeKey(code: string): string {
  return `${TV_QR_PREFIX}${code}`;
}

export async function createTvQrChallenge(): Promise<TvQrChallenge> {
  const client = getRedisClient();
  let code = randomCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if ((await client.exists(challengeKey(code))) === 0) break;
    code = randomCode();
  }
  const challenge: TvQrChallenge = {
    code,
    status: "awaiting_approval",
    createdAt: Date.now(),
    expiresAt: Date.now() + TV_QR_TTL_SECONDS * 1000,
  };
  await client.setex(challengeKey(code), TV_QR_TTL_SECONDS, JSON.stringify(challenge));
  return challenge;
}

export async function getTvQrChallenge(code: string): Promise<TvQrChallenge | null> {
  try {
    const raw = await getRedisClient().get(challengeKey(code));
    return raw ? (JSON.parse(raw) as TvQrChallenge) : null;
  } catch {
    return null;
  }
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
  const client = getRedisClient();
  const key = challengeKey(code);
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    const challenge = JSON.parse(raw) as TvQrChallenge;
    if (challenge.status !== "awaiting_approval") return null;
    challenge.status = "approved";
    challenge.accountId = accountId;
    challenge.claimToken = uuidv4();
    await client.setex(key, TV_QR_TTL_SECONDS, JSON.stringify(challenge));
    return challenge;
  } catch {
    return null;
  }
}

/**
 * Exchange a code + claimToken for the approving account. One-time use: the
 * challenge is deleted on success so a stolen claim token cannot be replayed.
 */
export async function claimTvQrChallenge(
  code: string,
  claimToken: string
): Promise<{ ok: true; accountId: string } | { ok: false }> {
  const client = getRedisClient();
  try {
    const raw = await client.get(challengeKey(code));
    if (!raw) return { ok: false };
    const challenge = JSON.parse(raw) as TvQrChallenge;
    if (
      challenge.status !== "approved" ||
      !challenge.claimToken ||
      challenge.claimToken !== claimToken ||
      !challenge.accountId
    ) {
      return { ok: false };
    }
    await client.del(challengeKey(code));
    return { ok: true, accountId: challenge.accountId };
  } catch {
    return { ok: false };
  }
}

export async function invalidateTvQrChallenge(code: string): Promise<void> {
  try {
    await getRedisClient().del(challengeKey(code));
  } catch {
    // noop
  }
}
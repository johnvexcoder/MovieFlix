import crypto from "crypto";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { adminRecoveryRequests, admins } from "@/db/schema";
import { securityHash } from "@/lib/admin-two-factor";
import { sendTelegramMessageDetailed, type TelegramSendResult } from "@/lib/telegram";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;

export async function generateSixDigitCode(): Promise<string> {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Starts an Admin Assistant (Telegram) recovery request for the given admin.
 * Returns the raw code, expiry, and the new request id.
 */
export async function startAdminAssistantRequest(adminId: string): Promise<{ code: string; expiresAt: string; requestId: string }> {
  const code = await generateSixDigitCode();
  const now = Date.now();
  const expiresAt = new Date(now + CODE_TTL_MS).toISOString();
  const requestId = uuidv4();

  // Invalidate any outstanding pending request for this admin (one active at a time).
  await db
    .update(adminRecoveryRequests)
    .set({ status: "consumed", consumedAt: new Date().toISOString() })
    .where(
      and(
        eq(adminRecoveryRequests.adminId, adminId),
        eq(adminRecoveryRequests.status, "pending")
      )
    );

  await db.insert(adminRecoveryRequests).values({
    id: requestId,
    adminId,
    method: "admin_assistant",
    codeHash: securityHash(code),
    status: "pending",
    attempts: 0,
    expiresAt,
    createdAt: new Date().toISOString(),
  });

  return { code, expiresAt, requestId };
}

/** Invalidates all pending Admin Assistant requests for an admin (used when delivery fails). */
export async function invalidateAdminAssistantRequests(adminId: string) {
  await db
    .update(adminRecoveryRequests)
    .set({ status: "consumed", consumedAt: new Date().toISOString() })
    .where(
      and(
        eq(adminRecoveryRequests.adminId, adminId),
        eq(adminRecoveryRequests.status, "pending")
      )
    );
}

/**
 * Verifies a submitted 6-digit Admin Assistant code. Consumes the request on
 * success (single-use) and returns true only for a valid, non-expired code with
 * attempts remaining.
 */
export async function verifyAdminAssistantCode(adminId: string, code: string): Promise<boolean> {
  const submittedHash = securityHash(code);
  const [request] = await db
    .select()
    .from(adminRecoveryRequests)
    .where(
      and(
        eq(adminRecoveryRequests.adminId, adminId),
        eq(adminRecoveryRequests.status, "pending")
      )
    )
    .orderBy(desc(adminRecoveryRequests.createdAt))
    .limit(1);

  if (!request) return false;
  if (new Date(request.expiresAt).getTime() <= Date.now()) {
    await db
      .update(adminRecoveryRequests)
      .set({ status: "consumed", consumedAt: new Date().toISOString() })
      .where(eq(adminRecoveryRequests.id, request.id));
    return false;
  }
  if (request.attempts >= MAX_ATTEMPTS) return false;
  if (request.codeHash !== submittedHash) {
    await db
      .update(adminRecoveryRequests)
      .set({ attempts: request.attempts + 1 })
      .where(eq(adminRecoveryRequests.id, request.id));
    return false;
  }

  await db
    .update(adminRecoveryRequests)
    .set({ status: "consumed", consumedAt: new Date().toISOString() })
    .where(eq(adminRecoveryRequests.id, request.id));
  return true;
}

/** True when the admin has an outstanding (non-expired) Admin Assistant request. */
export async function hasActiveAdminAssistantRequest(adminId: string): Promise<boolean> {
  const rows = await db
    .select({ id: adminRecoveryRequests.id, expiresAt: adminRecoveryRequests.expiresAt })
    .from(adminRecoveryRequests)
    .where(
      and(
        eq(adminRecoveryRequests.adminId, adminId),
        eq(adminRecoveryRequests.status, "pending")
      )
    )
    .limit(1);
  return rows.length > 0 && new Date(rows[0].expiresAt).getTime() > Date.now();
}

/** Resolves an admin by username or email. Returns null when not found. */
export async function findAdminByIdentity(identity: string) {
  const value = identity.trim().toLowerCase();
  const rows = await db
    .select()
    .from(admins)
    .where(or(sql`lower(${admins.username}) = ${value}`, eq(admins.email, value)))
    .limit(1);
  return rows[0] || null;
}

/** Notifies the Main Admin via Telegram of a recovery request. Returns detailed result. */
export async function notifyAdminAssistantRecovery(input: {
  code: string;
  adminLabel: string;
  expiresAt: string;
  requestId?: string;
}): Promise<TelegramSendResult> {
  const expiresInMinutes = Math.max(1, Math.round((new Date(input.expiresAt).getTime() - Date.now()) / 60000));
  const text = [
    "MovieFlix Admin Recovery Request",
    "",
    `Admin: ${input.adminLabel}`,
    `Recovery Code: ${input.code}`,
    `Expires: ${expiresInMinutes} minutes`,
    input.requestId ? `Request ID: ${input.requestId}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return sendTelegramMessageDetailed(text);
}
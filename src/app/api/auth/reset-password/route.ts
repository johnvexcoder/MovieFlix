import { NextRequest } from "next/server";
import crypto from "crypto";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { accounts, passwordResetTokens, profiles } from "@/db/schema";
import { hashPassword, getClientIp } from "@/lib/auth";
import { securityHash } from "@/lib/admin-two-factor";
import { successResponse, errorResponse } from "@/lib/api-response";
import { setRateLimit, revokeTokenVersion } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!(await setRateLimit(`ratelimit:reset-password:${ip}`, 15 * 60 * 1000, 8)).allowed) return errorResponse("Too many requests. Please try again later.", 429);
    const { token, identifier, verificationCode, newPassword } = await request.json();
    if (typeof newPassword !== "string" || newPassword.length < 10 || !/[a-z]/i.test(newPassword) || !/[0-9]/.test(newPassword)) return errorResponse("New password must contain at least 10 characters, a letter, and a number", 400);

    let resetToken: typeof passwordResetTokens.$inferSelect | undefined;
    if (typeof token === "string" && token) {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      [resetToken] = await db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt))).limit(1);
    } else {
      if (typeof identifier !== "string" || typeof verificationCode !== "string") return errorResponse("Username and verification code are required", 400);
      const identity = identifier.trim().toLowerCase();
      const [account] = await db.select().from(accounts).where(or(sql`lower(${accounts.username}) = ${identity}`, eq(accounts.email, identity))).limit(1);
      if (account) [resetToken] = await db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.accountId, account.id), isNull(passwordResetTokens.usedAt))).orderBy(desc(passwordResetTokens.createdAt)).limit(1);
      if (!resetToken || resetToken.attempts >= 5 || !resetToken.codeHash || resetToken.codeHash !== securityHash(verificationCode)) {
        if (resetToken && resetToken.attempts < 5) await db.update(passwordResetTokens).set({ attempts: resetToken.attempts + 1 }).where(eq(passwordResetTokens.id, resetToken.id));
        return errorResponse("Invalid or expired verification code", 400);
      }
    }
    if (!resetToken || resetToken.usedAt || new Date(resetToken.expiresAt).getTime() <= Date.now()) return errorResponse("Invalid or expired password reset", 400);
    const [account] = await db.select().from(accounts).where(eq(accounts.id, resetToken.accountId)).limit(1);
    if (!account) return errorResponse("Account not found", 404);

    const now = new Date().toISOString();
    await db.update(accounts).set({ passwordHash: await hashPassword(newPassword), mustChangePassword: false, updatedAt: now }).where(eq(accounts.id, account.id));
    await db.update(passwordResetTokens).set({ usedAt: now }).where(and(eq(passwordResetTokens.accountId, account.id), isNull(passwordResetTokens.usedAt)));
    const accountProfiles = await db.select().from(profiles).where(eq(profiles.accountId, account.id));
    for (const profile of accountProfiles) await revokeTokenVersion(profile.id);
    return successResponse({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse("Internal server error", 500);
  }
}

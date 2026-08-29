import { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { accounts, passwordResetTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { setRateLimit, revokeTokenVersion } from "@/lib/redis";
import { profiles } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await setRateLimit(`ratelimit:reset-password:${ip}`, 15 * 60 * 1000, 5);
    if (!rateLimit.allowed) {
      return errorResponse("Too many requests. Please try again later.", 429);
    }

    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || typeof token !== "string" || !newPassword || typeof newPassword !== "string") {
      return errorResponse("Token and new password are required", 400);
    }
    if (newPassword.length < 6) {
      return errorResponse("New password must be at least 6 characters", 400);
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (!resetToken) {
      return errorResponse("Invalid or expired reset link", 400);
    }
    if (resetToken.usedAt) {
      return errorResponse("This reset link has already been used", 400);
    }
    if (new Date(resetToken.expiresAt) < new Date()) {
      return errorResponse("This reset link has expired", 400);
    }

    const [account] = await db.select().from(accounts).where(eq(accounts.id, resetToken.accountId)).limit(1);
    if (!account) {
      return errorResponse("Account not found", 404);
    }

    const passwordHash = await hashPassword(newPassword);
    await db
      .update(accounts)
      .set({ passwordHash, mustChangePassword: false, updatedAt: new Date().toISOString() })
      .where(eq(accounts.id, account.id));

    // Mark the token used and revoke all sessions for every profile.
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date().toISOString() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    const accountProfiles = await db.select().from(profiles).where(eq(profiles.accountId, account.id));
    for (const p of accountProfiles) {
      await revokeTokenVersion(p.id);
    }

    return successResponse({ message: "Password reset successfully. You can now log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return errorResponse("Internal server error", 500);
  }
}

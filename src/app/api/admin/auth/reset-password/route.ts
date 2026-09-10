import { NextRequest } from "next/server";
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { adminPasswordResetTokens, admins } from "@/db/schema";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getClientIp, hashPassword } from "@/lib/auth";
import { securityHash } from "@/lib/admin-two-factor";
import { revokeTokenVersion, setRateLimit } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!(await setRateLimit(`admin-password-reset:${ip}`, 15 * 60 * 1000, 8)).allowed) return errorResponse("Too many reset attempts. Try again later.", 429);
    const { token, identifier, verificationCode, newPassword } = await request.json();
    if (typeof newPassword !== "string" || newPassword.length < 8) return errorResponse("Administrator password must contain at least 8 characters", 400);

    let adminId = "";
    let resetId = "";
    let recoveryIndex = -1;
    let recoveryHashes: string[] = [];
    if (typeof token === "string" && token) {
      const [reset] = await db.select().from(adminPasswordResetTokens).where(and(eq(adminPasswordResetTokens.tokenHash, securityHash(token)), isNull(adminPasswordResetTokens.usedAt))).limit(1);
      if (!reset || new Date(reset.expiresAt).getTime() <= Date.now()) return errorResponse("This reset link is invalid or expired", 400);
      adminId = reset.adminId; resetId = reset.id;
    } else {
      if (typeof identifier !== "string" || typeof verificationCode !== "string") return errorResponse("Username and verification code are required", 400);
      const identity = identifier.trim().toLowerCase();
      const [admin] = await db.select().from(admins).where(or(sql`lower(${admins.username}) = ${identity}`, eq(admins.email, identity))).limit(1);
      if (!admin) return errorResponse("Invalid or expired verification code", 400);
      const submittedHash = securityHash(verificationCode);
      try { recoveryHashes = JSON.parse(admin.recoveryCodesHash || "[]"); } catch { recoveryHashes = []; }
      recoveryIndex = recoveryHashes.indexOf(submittedHash);
      if (recoveryIndex < 0) {
        const [reset] = await db.select().from(adminPasswordResetTokens).where(and(eq(adminPasswordResetTokens.adminId, admin.id), isNull(adminPasswordResetTokens.usedAt))).orderBy(desc(adminPasswordResetTokens.createdAt)).limit(1);
        if (!reset || reset.attempts >= 5 || new Date(reset.expiresAt).getTime() <= Date.now() || reset.codeHash !== submittedHash) {
          if (reset && reset.attempts < 5) await db.update(adminPasswordResetTokens).set({ attempts: reset.attempts + 1 }).where(eq(adminPasswordResetTokens.id, reset.id));
          return errorResponse("Invalid or expired verification code", 400);
        }
        resetId = reset.id;
      }
      adminId = admin.id;
    }

    const [admin] = await db.select().from(admins).where(eq(admins.id, adminId)).limit(1);
    if (!admin) return errorResponse("Administrator account not found", 404);
    if (recoveryIndex >= 0) {
      recoveryHashes.splice(recoveryIndex, 1);
      await db.update(admins).set({ passwordHash: await hashPassword(newPassword), recoveryCodesHash: JSON.stringify(recoveryHashes) }).where(eq(admins.id, admin.id));
    } else {
      await db.update(admins).set({ passwordHash: await hashPassword(newPassword) }).where(eq(admins.id, admin.id));
    }
    const now = new Date().toISOString();
    if (resetId) await db.update(adminPasswordResetTokens).set({ usedAt: now }).where(eq(adminPasswordResetTokens.id, resetId));
    await db.update(adminPasswordResetTokens).set({ usedAt: now }).where(and(eq(adminPasswordResetTokens.adminId, admin.id), isNull(adminPasswordResetTokens.usedAt)));
    await revokeTokenVersion(admin.id);
    return successResponse({ message: "Administrator password reset. Sign in with the new password." });
  } catch (error) {
    console.error("Admin reset-password error:", error);
    return errorResponse("Could not reset administrator password", 500);
  }
}

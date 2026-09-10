import crypto from "crypto";
import { NextRequest } from "next/server";
import { eq, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { adminPasswordResetTokens, admins } from "@/db/schema";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getAppPublicUrl } from "@/lib/app-settings";
import { getClientIp } from "@/lib/auth";
import { adminPasswordResetEmail, generateEmailCode, securityHash } from "@/lib/admin-two-factor";
import { sendEmail } from "@/lib/email";
import { setRateLimit } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!(await setRateLimit(`admin-password-help:${ip}`, 15 * 60 * 1000, 5)).allowed) return errorResponse("Too many requests. Try again later.", 429);
    const { identifier } = await request.json();
    if (typeof identifier !== "string" || !identifier.trim()) return errorResponse("Administrator username or email is required", 400);
    const generic = "If the administrator account exists and has a recovery email, reset instructions have been sent.";
    const value = identifier.trim();
    const [admin] = await db.select().from(admins).where(or(eq(admins.username, value), eq(admins.email, value))).limit(1);
    if (!admin?.email) return successResponse({ message: generic });

    const token = crypto.randomBytes(32).toString("base64url");
    const code = generateEmailCode();
    await db.insert(adminPasswordResetTokens).values({ id: uuidv4(), adminId: admin.id, tokenHash: securityHash(token), codeHash: securityHash(code), expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), createdAt: new Date().toISOString() });
    const resetLink = `${await getAppPublicUrl()}/admin-panel/reset-password?token=${encodeURIComponent(token)}`;
    const delivered = await sendEmail({ to: admin.email, subject: "Reset your MovieFlix administrator password", html: adminPasswordResetEmail(code, resetLink) });
    if (!delivered) return errorResponse("The recovery email could not be delivered. Check SMTP settings or contact another administrator.", 503);
    return successResponse({ message: generic });
  } catch (error) {
    console.error("Admin forgot-password error:", error);
    return errorResponse("Could not start administrator recovery", 500);
  }
}

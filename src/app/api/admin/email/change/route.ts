import { NextRequest } from "next/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/db";
import { admins, adminEmailChangeTokens } from "@/db/schema";
import { verifyToken, comparePassword, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { securityHash, generateEmailCode, adminCodeEmail } from "@/lib/admin-two-factor";
import { sendEmail } from "@/lib/email";
import { setRateLimit } from "@/lib/redis";
import { logAdminAudit } from "@/lib/admin-audit";

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

async function currentAdmin(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isAdmin) return null;
  const [admin] = await db.select().from(admins).where(eq(admins.id, payload.profileId)).limit(1);
  return admin || null;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!(await setRateLimit(`admin-email-change:${ip}`, 15 * 60 * 1000, 5)).allowed) {
      return errorResponse("Too many requests. Try again later.", 429);
    }

    const admin = await currentAdmin(request);
    if (!admin) return errorResponse("Unauthorized", 401);

    const { newEmail, currentPassword } = await request.json();
    if (typeof newEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      return errorResponse("Enter a valid email address", 400);
    }
    if (typeof currentPassword !== "string" || !currentPassword) {
      return errorResponse("Current password is required", 400);
    }
    const valid = await comparePassword(currentPassword, admin.passwordHash);
    if (!valid) return errorResponse("Current password is incorrect", 401);

    const value = newEmail.trim().toLowerCase();
    if (value === admin.email?.toLowerCase()) return errorResponse("New email must differ from the current email", 400);

    const [existing] = await db
      .select({ id: admins.id })
      .from(admins)
      .where(or(sql`lower(${admins.email}) = ${value}`, eq(admins.email, value)))
      .limit(1);
    if (existing && existing.id !== admin.id) return errorResponse("That email is already in use by another administrator", 400);

    // Invalidate any prior pending change for this admin.
    await db
      .update(adminEmailChangeTokens)
      .set({ status: "consumed", usedAt: new Date().toISOString() })
      .where(and(eq(adminEmailChangeTokens.adminId, admin.id), eq(adminEmailChangeTokens.status, "pending")));

    const code = generateEmailCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
    await db.insert(adminEmailChangeTokens).values({
      id: uuidv4(),
      adminId: admin.id,
      newEmail: value,
      codeHash: securityHash(code),
      status: "pending",
      attempts: 0,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    const delivered = await sendEmail({ to: value, subject: "Verify your new MovieFlix admin email", html: adminCodeEmail(code) });
    if (!delivered) return errorResponse("The verification email could not be delivered. Check SMTP settings.", 503);

    await logAdminAudit({ adminId: admin.id, actor: admin.username, action: "admin.email_change_requested", detail: "Email change verification requested", ip });
    return successResponse({ message: "A verification code was sent to the new email address." });
  } catch (error) {
    console.error("Admin email change request error:", error);
    return errorResponse("Could not start email change", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!(await setRateLimit(`admin-email-verify:${ip}`, 15 * 60 * 1000, 8)).allowed) {
      return errorResponse("Too many attempts. Try again later.", 429);
    }

    const admin = await currentAdmin(request);
    if (!admin) return errorResponse("Unauthorized", 401);

    const { code } = await request.json();
    if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) return errorResponse("Enter the 6-digit verification code", 400);

    const [pending] = await db
      .select()
      .from(adminEmailChangeTokens)
      .where(and(eq(adminEmailChangeTokens.adminId, admin.id), eq(adminEmailChangeTokens.status, "pending")))
      .orderBy(desc(adminEmailChangeTokens.createdAt))
      .limit(1);
    if (!pending || pending.codeHash !== securityHash(code.trim())) return errorResponse("Invalid or expired verification code", 400);
    if (new Date(pending.expiresAt).getTime() <= Date.now()) return errorResponse("Verification code has expired", 400);
    if (pending.attempts >= MAX_ATTEMPTS) return errorResponse("Too many attempts. Request a new code.", 400);

    await db.update(admins).set({ email: pending.newEmail }).where(eq(admins.id, admin.id));
    await db.update(adminEmailChangeTokens).set({ status: "consumed", usedAt: new Date().toISOString() }).where(eq(adminEmailChangeTokens.id, pending.id));

    await logAdminAudit({ adminId: admin.id, actor: admin.username, action: "admin.email_changed", detail: `Email changed to ${pending.newEmail}`, ip });
    return successResponse({ message: "Administrator email updated successfully." });
  } catch (error) {
    console.error("Admin email change verify error:", error);
    return errorResponse("Could not verify email change", 500);
  }
}
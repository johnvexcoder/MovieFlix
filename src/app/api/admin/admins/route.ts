import { NextRequest } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { verifyToken, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getSmtpSettings } from "@/lib/email";
import { createInvite, sendAdminInviteEmail, isMainAdmin } from "@/lib/admin-invite";
import { logAdminAudit } from "@/lib/admin-audit";
import { setRateLimit } from "@/lib/redis";

async function currentAdmin(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload?.isAdmin) return null;
  const [admin] = await db.select().from(admins).where(eq(admins.id, payload.profileId)).limit(1);
  return admin || null;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await currentAdmin(request);
    if (!admin) return errorResponse("Unauthorized", 401);

    const allAdmins = await db
      .select({
        id: admins.id,
        username: admins.username,
        email: admins.email,
        twoFactorEnabled: admins.twoFactorEnabled,
        role: admins.role,
        status: admins.status,
        createdAt: admins.createdAt,
        lastLoginAt: admins.lastLoginAt,
        setupCompletedAt: admins.setupCompletedAt,
        createdByAdminId: admins.createdByAdminId,
      })
      .from(admins)
      .orderBy(admins.createdAt);

    return successResponse({ admins: allAdmins, selfId: admin.id });
  } catch (error) {
    console.error("List admins error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const admin = await currentAdmin(request);
    if (!admin) return errorResponse("Unauthorized", 401);
    if (!isMainAdmin(admin.role)) return errorResponse("Only the Main Admin can add administrators", 403);
    if (!(await setRateLimit(`admin-invite:${ip}`, 60 * 60 * 1000, 20)).allowed) return errorResponse("Too many invitations. Try again later.", 429);

    const { username, email } = await request.json();
    const cleanUsername = String(username || "").trim().toLowerCase();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanUsername) return errorResponse("Username is required", 400);
    if (!/^[a-z0-9_.-]{2,32}$/.test(cleanUsername)) return errorResponse("Username must be 2–32 characters (letters, numbers, . _ -)", 400);
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return errorResponse("A valid administrator email is required", 400);

    const existing = await db
      .select({ id: admins.id })
      .from(admins)
      .where(or(eq(admins.username, cleanUsername), sql`lower(${admins.email}) = ${cleanEmail}`))
      .limit(1);
    if (existing.length > 0) return errorResponse("That username or email is already in use", 409);

    // Invitation flow depends on SMTP.
    const smtp = await getSmtpSettings();
    if (!smtp.host || !smtp.user || !smtp.pass) {
      return errorResponse("Administrator invitation could not be sent because SMTP is not configured.", 400);
    }

    const now = new Date().toISOString();
    const adminId = uuidv4();
    await db.insert(admins).values({
      id: adminId,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: "", // no password yet — pending setup
      role: "admin",
      status: "pending_setup",
      createdByAdminId: admin.id,
      createdAt: now,
    });

    const { token } = await createInvite(adminId);
    const delivered = await sendAdminInviteEmail({ username: cleanUsername, email: cleanEmail }, token);

    if (!delivered) {
      // Roll back the half-created admin so there is no ambiguous pending account.
      await db.delete(admins).where(eq(admins.id, adminId));
      return errorResponse("The invitation email could not be sent. Check SMTP settings and try again.", 503);
    }

    await logAdminAudit({ adminId: admin.id, actor: admin.username, action: "admin.invite_created", detail: `Invited administrator "${cleanUsername}"`, ip });
    return successResponse({ admin: { id: adminId, username: cleanUsername, email: cleanEmail, status: "pending_setup", role: "admin" } }, 201);
  } catch (error) {
    console.error("Create admin invite error:", error);
    return errorResponse("Internal server error", 500);
  }
}
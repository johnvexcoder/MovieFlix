import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { successResponse, errorResponse } from "@/lib/api-response";
import { hashPassword, getClientIp } from "@/lib/auth";
import { setRateLimit } from "@/lib/redis";
import { findValidInviteByToken, consumeInvite, sendAdminActivatedEmail, invalidateAllInvites } from "@/lib/admin-invite";
import { logAdminAudit } from "@/lib/admin-audit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!(await setRateLimit(`admin-invite-activate:${ip}`, 60 * 60 * 1000, 10)).allowed) return errorResponse("Too many attempts. Try again later.", 429);

    const { token, newPassword } = await request.json();
    if (typeof token !== "string" || !token) return errorResponse("This administrator invitation is invalid or has expired.", 400);
    if (typeof newPassword !== "string" || newPassword.length < 8) return errorResponse("Password must be at least 8 characters", 400);

    const result = await findValidInviteByToken(token);
    if (!result || result.state !== "valid") return errorResponse("This administrator invitation is invalid or has expired.", 400);

    const [admin] = await db.select().from(admins).where(eq(admins.id, result.invite.adminId)).limit(1);
    if (!admin || admin.status !== "pending_setup") return errorResponse("This administrator invitation is invalid or has expired.", 400);

    const now = new Date().toISOString();
    await db.update(admins).set({
      passwordHash: await hashPassword(newPassword),
      status: "active",
      setupCompletedAt: now,
    }).where(eq(admins.id, admin.id));

    await consumeInvite(result.invite.id);
    await invalidateAllInvites(admin.id);
    await sendAdminActivatedEmail({ username: admin.username, email: admin.email });
    await logAdminAudit({ adminId: admin.id, actor: admin.username, action: "admin.account_activated", detail: "Administrator activated via invitation", ip });

    return successResponse({ message: "Your administrator account is ready. Please sign in." });
  } catch (error) {
    console.error("Activate admin invite error:", error);
    return errorResponse("Could not activate administrator account", 500);
  }
}
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getClientIp, hashPassword } from "@/lib/auth";
import { setRateLimit, revokeTokenVersion } from "@/lib/redis";
import { findAdminByIdentity, verifyAdminAssistantCode } from "@/lib/admin-recovery";
import { logAdminAudit } from "@/lib/admin-audit";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!(await setRateLimit(`admin-assistant-reset:${ip}`, 15 * 60 * 1000, 8)).allowed) {
      return errorResponse("Too many attempts. Try again later.", 429);
    }

    const { identifier, code, newPassword } = await request.json();
    if (typeof identifier !== "string" || !identifier.trim()) {
      return errorResponse("Administrator username or email is required", 400);
    }
    if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
      return errorResponse("Enter the 6-digit recovery code", 400);
    }
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return errorResponse("Administrator password must contain at least 8 characters", 400);
    }

    const admin = await findAdminByIdentity(identifier);
    if (!admin) return errorResponse("Invalid or expired recovery code", 400);

    const ok = await verifyAdminAssistantCode(admin.id, code.trim());
    if (!ok) return errorResponse("Invalid, expired, or used recovery code", 400);

    await db.update(admins).set({ passwordHash: await hashPassword(newPassword) }).where(eq(admins.id, admin.id));
    await revokeTokenVersion(admin.id);

    await logAdminAudit({
      adminId: admin.id,
      actor: admin.username,
      action: "recovery.admin_assistant_completed",
      detail: "Password reset completed via Admin Assistant",
      ip,
    });

    return successResponse({ message: "Password reset. Sign in with the new password." });
  } catch (error) {
    console.error("Admin assistant recovery reset error:", error);
    return errorResponse("Could not reset administrator password", 500);
  }
}
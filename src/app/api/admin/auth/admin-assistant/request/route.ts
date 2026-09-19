import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/api-response";
import { getClientIp } from "@/lib/auth";
import { setRateLimit } from "@/lib/redis";
import { findAdminByIdentity, hasActiveAdminAssistantRequest, startAdminAssistantRequest, notifyAdminAssistantRecovery, invalidateAdminAssistantRequests } from "@/lib/admin-recovery";
import { logAdminAudit } from "@/lib/admin-audit";

const GENERIC = "If the administrator account exists, a code request has been sent to the Main Admin via Telegram.";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!(await setRateLimit(`admin-assistant-request:${ip}`, 15 * 60 * 1000, 5)).allowed) {
      return errorResponse("Too many requests. Try again later.", 429);
    }

    const { identifier } = await request.json();
    if (typeof identifier !== "string" || !identifier.trim()) {
      return errorResponse("Administrator username or email is required", 400);
    }

    const admin = await findAdminByIdentity(identifier);
    if (!admin?.email) return successResponse({ message: GENERIC });

    // One active Admin Assistant request per admin at a time.
    if (await hasActiveAdminAssistantRequest(admin.id)) {
      return successResponse({ message: "A recovery request is already pending for this administrator. Check with the Main Admin." });
    }

    const { code, expiresAt, requestId } = await startAdminAssistantRequest(admin.id);
    const masked = admin.email ? `${admin.email.slice(0, 1)}***@${admin.email.split("@")[1] || ""}` : admin.username;
    const result = await notifyAdminAssistantRecovery({
      code,
      adminLabel: masked,
      expiresAt,
      requestId,
    });

    if (!result.ok) {
      // Delivery failed — invalidate the OTP so it can never be used, and never
      // report success. Log the classified error (without the token).
      await invalidateAdminAssistantRequests(admin.id);
      await logAdminAudit({
        adminId: admin.id,
        actor: admin.username,
        action: "recovery.admin_assistant_failed",
        detail: `Admin Assistant Telegram delivery failed: ${result.detail || result.error || "unknown"}`,
        ip,
      });
      return errorResponse("Admin Assistant could not send the recovery request. Try another recovery method or contact the Main Admin.", 503);
    }

    await logAdminAudit({
      adminId: admin.id,
      actor: admin.username,
      action: "recovery.admin_assistant_requested",
      detail: "Admin Assistant recovery code requested via Telegram",
      ip,
    });

    return successResponse({ message: "A 6-digit recovery code was sent to the Main Admin via Telegram." });
  } catch (error) {
    console.error("Admin assistant recovery request error:", error);
    return errorResponse("Could not start recovery request", 500);
  }
}
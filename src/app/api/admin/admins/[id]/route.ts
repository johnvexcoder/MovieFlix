import { NextRequest } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { invalidateAllInvites, isMainAdmin } from "@/lib/admin-invite";
import { logAdminAudit } from "@/lib/admin-audit";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const token = request.cookies.get("admin_token")?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload?.isAdmin) return errorResponse("Admin access required", 403);

    const [actor] = await db.select().from(admins).where(eq(admins.id, payload.profileId)).limit(1);
    if (!actor) return errorResponse("Unauthorized", 401);
    if (!isMainAdmin(actor.role)) return errorResponse("Only the Main Admin can remove administrators", 403);

    if (payload.profileId === id) {
      return errorResponse("You cannot remove your own admin account", 400);
    }

    const [target] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
    if (!target) return errorResponse("Admin not found", 404);

    // Never allow removing the last Main Admin.
    const mainAdmins = await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.role, "main_admin"));
    if (target.role === "main_admin" && mainAdmins.length <= 1) {
      return errorResponse("Cannot remove the last Main Admin", 400);
    }

    // Prevent removing the final administrator account entirely.
    const total = await db.select({ id: admins.id }).from(admins);
    if (total.length <= 1) {
      return errorResponse("Cannot remove the last admin account", 400);
    }

    await invalidateAllInvites(target.id);
    await db.delete(admins).where(eq(admins.id, id));
    await logAdminAudit({ adminId: actor.id, actor: actor.username, action: "admin.account_removed", detail: `Removed administrator "${target.username}"`, ip: getClientIp(request) });
    return successResponse({ deleted: true });
  } catch (error) {
    console.error("Delete admin error:", error);
    return errorResponse("Internal server error", 500);
  }
}
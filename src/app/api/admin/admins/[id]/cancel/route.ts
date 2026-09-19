import { NextRequest } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { invalidateAllInvites, isMainAdmin } from "@/lib/admin-invite";
import { logAdminAudit } from "@/lib/admin-audit";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const token = request.cookies.get("admin_token")?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload?.isAdmin) return errorResponse("Unauthorized", 401);
    const [actor] = await db.select().from(admins).where(eq(admins.id, payload.profileId)).limit(1);
    if (!actor) return errorResponse("Unauthorized", 401);
    if (!isMainAdmin(actor.role)) return errorResponse("Only the Main Admin can cancel invitations", 403);

    const [target] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
    if (!target) return errorResponse("Administrator not found", 404);
    if (target.status !== "pending_setup") return errorResponse("Only pending-setup invitations can be cancelled", 400);

    await invalidateAllInvites(target.id);
    await db.update(admins).set({ status: "disabled" }).where(eq(admins.id, target.id));
    await logAdminAudit({ adminId: actor.id, actor: actor.username, action: "admin.invite_cancelled", detail: `Cancelled invitation for "${target.username}"`, ip: getClientIp(request) });
    return successResponse({ message: "Invitation cancelled." });
  } catch (error) {
    console.error("Cancel admin invite error:", error);
    return errorResponse("Internal server error", 500);
  }
}
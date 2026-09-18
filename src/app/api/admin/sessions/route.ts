import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { verifyToken, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { revokeTokenVersion } from "@/lib/redis";
import { logAdminAudit } from "@/lib/admin-audit";

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) return errorResponse("Unauthorized", 401);
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) return errorResponse("Admin access required", 403);

    const [admin] = await db.select().from(admins).where(eq(admins.id, payload.profileId)).limit(1);
    if (!admin) return errorResponse("Administrator not found", 404);

    // Bumping the token version invalidates every active admin session,
    // including the current one, so the admin must sign back in.
    await revokeTokenVersion(admin.id);
    await logAdminAudit({ adminId: admin.id, actor: admin.username, action: "admin.sessions_revoked", detail: "All admin sessions signed out", ip: getClientIp(request) });

    return successResponse({ message: "All admin sessions have been signed out. Please sign in again." });
  } catch (error) {
    console.error("Admin sessions revoke error:", error);
    return errorResponse("Could not sign out sessions", 500);
  }
}
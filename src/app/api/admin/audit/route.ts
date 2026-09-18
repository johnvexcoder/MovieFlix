import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getAdminAuditLog } from "@/lib/admin-audit";

export async function GET(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) return errorResponse("Unauthorized", 401);
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) return errorResponse("Admin access required", 403);

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.max(1, Math.min(500, parseInt(limitParam || "100", 10) || 100));
    const log = await getAdminAuditLog(limit);
    return successResponse({ log });
  } catch (error) {
    console.error("Audit log read error:", error);
    return errorResponse("Could not load audit log", 500);
  }
}
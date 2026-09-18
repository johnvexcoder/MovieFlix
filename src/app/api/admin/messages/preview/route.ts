import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { resolveBroadcastTarget, type BroadcastTargetSpec } from "@/lib/broadcast-targeting";

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) return errorResponse("Unauthorized", 401);
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) return errorResponse("Admin access required", 403);

    const { audience } = await request.json();
    if (!audience || typeof audience !== "object" || typeof (audience as BroadcastTargetSpec).mode !== "string") {
      return errorResponse("Invalid audience selection", 400);
    }
    const { count } = await resolveBroadcastTarget(audience as BroadcastTargetSpec);
    return successResponse({ count });
  } catch (error) {
    console.error("Announcement audience preview error:", error);
    return errorResponse("Could not resolve audience", 500);
  }
}
import { NextRequest } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) return errorResponse("Unauthorized", 401);

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    if (payload.profileId === id) {
      return errorResponse("You cannot remove your own admin account", 400);
    }

    const [target] = await db
      .select({ id: admins.id })
      .from(admins)
      .where(eq(admins.id, id))
      .limit(1);

    if (!target) {
      return errorResponse("Admin not found", 404);
    }

    const adminCount = await db
      .select({ id: admins.id })
      .from(admins);

    if (adminCount.length <= 1) {
      return errorResponse("Cannot remove the last admin account", 400);
    }

    await db.delete(admins).where(eq(admins.id, id));

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("Delete admin error:", error);
    return errorResponse("Internal server error", 500);
  }
}
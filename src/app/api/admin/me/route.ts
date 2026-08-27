import { NextRequest } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, hashPassword, comparePassword } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function PATCH(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) return errorResponse("Unauthorized", 401);

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || typeof currentPassword !== "string") {
      return errorResponse("Current password is required", 400);
    }
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return errorResponse("New password must be at least 6 characters", 400);
    }

    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.id, payload.profileId))
      .limit(1);

    if (!admin) {
      return errorResponse("Admin not found", 404);
    }

    const valid = await comparePassword(currentPassword, admin.passwordHash);
    if (!valid) {
      return errorResponse("Current password is incorrect", 401);
    }

    const passwordHash = await hashPassword(newPassword);
    await db
      .update(admins)
      .set({ passwordHash })
      .where(eq(admins.id, admin.id));

    return successResponse({ updated: true });
  } catch (error) {
    console.error("Change admin password error:", error);
    return errorResponse("Internal server error", 500);
  }
}
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;

    if (!adminToken) {
      return errorResponse("Not authenticated", 401);
    }

    const payload = await verifyToken(adminToken);
    if (!payload || !payload.isAdmin) {
      return errorResponse("Invalid admin token", 401);
    }

    // Get admin from database
    const [admin] = await db
      .select({
        id: admins.id,
        username: admins.username,
      })
      .from(admins)
      .where(eq(admins.id, payload.profileId))
      .limit(1);

    if (!admin) {
      return errorResponse("Admin not found", 404);
    }

    return successResponse({
      id: admin.id,
      username: admin.username,
    });
  } catch (error) {
    console.error("Admin me error:", error);
    return errorResponse("Internal server error", 500);
  }
}

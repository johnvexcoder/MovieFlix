import { NextRequest } from "next/server";
import { db } from "@/db";
import { paymentSubmissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const [existing] = await db
      .select()
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.id, id))
      .limit(1);
    if (!existing) {
      return errorResponse("Payment submission not found", 404);
    }

    await db.delete(paymentSubmissions).where(eq(paymentSubmissions.id, id));
    return successResponse({ message: "Payment submission deleted" });
  } catch (error) {
    console.error("Admin delete payment submission error:", error);
    return errorResponse("Internal server error", 500);
  }
}
import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminMessages, messageViews } from "@/db/schema";
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

    const [existing] = await db.select().from(adminMessages).where(eq(adminMessages.id, id)).limit(1);
    if (!existing) {
      return errorResponse("Message not found", 404);
    }

    // message_views.message_id references this row (FK), so drop those first.
    await db.transaction(async (tx) => {
      await tx.delete(messageViews).where(eq(messageViews.messageId, id));
      await tx.delete(adminMessages).where(eq(adminMessages.id, id));
    });
    return successResponse({ message: "Message deleted" });
  } catch (error) {
    console.error("Admin delete message error:", error);
    return errorResponse("Internal server error", 500);
  }
}
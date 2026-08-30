import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminMessages, messageViews } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

/**
 * Marks a message as viewed for the authenticated account. Once marked, the
 * message will never be returned by GET /api/messages again for that account,
 * regardless of how many new sessions/logins that account starts.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Not authenticated", 401);
    }
    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    const [message] = await db
      .select()
      .from(adminMessages)
      .where(eq(adminMessages.id, id))
      .limit(1);
    if (!message) {
      return errorResponse("Message not found", 404);
    }

    const [existing] = await db
      .select()
      .from(messageViews)
      .where(
        and(
          eq(messageViews.messageId, id),
          eq(messageViews.accountId, payload.accountId)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(messageViews).values({
        id: uuidv4(),
        accountId: payload.accountId,
        messageId: id,
        viewedAt: new Date().toISOString(),
      });
    }

    return successResponse({ message: "Marked as viewed" });
  } catch (error) {
    console.error("Mark message viewed error:", error);
    return errorResponse("Internal server error", 500);
  }
}
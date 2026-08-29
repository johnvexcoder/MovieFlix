import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminMessages, accounts } from "@/db/schema";
import { eq, and, or, isNull, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Not authenticated", 401);
    }
    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    const [account] = await db.select().from(accounts).where(eq(accounts.id, payload.accountId)).limit(1);
    if (!account) {
      return errorResponse("Account not found", 404);
    }

    // Broadcast messages (accountId IS NULL) or messages targeted at this account.
    const messages = await db
      .select()
      .from(adminMessages)
      .where(
        and(
          or(isNull(adminMessages.accountId), eq(adminMessages.accountId, account.id))
        )
      )
      .orderBy(desc(adminMessages.createdAt))
      .limit(50);

    return successResponse({
      messages: messages.map((m) => ({
        id: m.id,
        message: m.message,
        createdAt: m.createdAt,
        broadcast: m.accountId === null,
      })),
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return errorResponse("Internal server error", 500);
  }
}
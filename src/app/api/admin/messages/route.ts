import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminMessages, accounts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const messages = await db
      .select({
        id: adminMessages.id,
        message: adminMessages.message,
        accountId: adminMessages.accountId,
        createdAt: adminMessages.createdAt,
        accountUsername: accounts.username,
      })
      .from(adminMessages)
      .leftJoin(accounts, eq(adminMessages.accountId, accounts.id))
      .orderBy(desc(adminMessages.createdAt))
      .limit(200);

    return successResponse({
      messages: messages.map((m) => ({
        id: m.id,
        message: m.message,
        accountId: m.accountId,
        broadcast: m.accountId === null,
        accountUsername: m.accountUsername,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin list messages error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const body = await request.json();
    const { message, accountId } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return errorResponse("Message is required", 400);
    }
    if (message.length > 2000) {
      return errorResponse("Message is too long (max 2000 characters)", 400);
    }

    // accountId === null/undefined/empty => broadcast to everyone.
    let targetAccountId: string | null = null;
    if (accountId && typeof accountId === "string") {
      targetAccountId = accountId;
      const [account] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
      if (!account) {
        return errorResponse("Target account not found", 404);
      }
    }

    await db.insert(adminMessages).values({
      id: uuidv4(),
      message: message.trim(),
      accountId: targetAccountId,
      createdByAdminId: payload.profileId,
      createdAt: new Date().toISOString(),
    });

    return successResponse(
      {
        message: targetAccountId
          ? "Message sent to the account"
          : "Broadcast message sent to all accounts",
      },
      201
    );
  } catch (error) {
    console.error("Admin create message error:", error);
    return errorResponse("Internal server error", 500);
  }
}
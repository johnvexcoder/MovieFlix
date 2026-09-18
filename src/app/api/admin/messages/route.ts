import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminMessages, accounts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";
import { resolveBroadcastTarget, type BroadcastTargetSpec } from "@/lib/broadcast-targeting";
import { logAdminAudit } from "@/lib/admin-audit";
import { getClientIp } from "@/lib/auth";

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
        title: adminMessages.title,
        priority: adminMessages.priority,
        audienceType: adminMessages.audienceType,
        expiresAt: adminMessages.expiresAt,
        active: adminMessages.active,
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
        title: m.title,
        priority: m.priority,
        audienceType: m.audienceType,
        expiresAt: m.expiresAt,
        active: m.active,
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
    const { message, accountId, title, audience, displayHomepage, displayStreaming, priority, expiresAt } = body;

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

    // Announcement audience (in-app broadcast). When provided, the message is an
    // announcement; audience determines who sees it at read time.
    let audienceSpec: BroadcastTargetSpec | null = null;
    let recipientCount = targetAccountId ? 1 : null;
    if (!targetAccountId && audience && typeof audience === "object" && typeof (audience as BroadcastTargetSpec).mode === "string") {
      audienceSpec = audience as BroadcastTargetSpec;
      const resolved = await resolveBroadcastTarget(audienceSpec);
      recipientCount = resolved.count;
    }

    await db.insert(adminMessages).values({
      id: uuidv4(),
      message: message.trim(),
      accountId: targetAccountId,
      createdByAdminId: payload.profileId,
      createdAt: new Date().toISOString(),
      title: typeof title === "string" && title.trim() ? title.trim().slice(0, 120) : null,
      priority: ["normal", "important", "critical"].includes(priority) ? priority : "normal",
      audienceType: audienceSpec?.mode ?? "all",
      audienceFilter: audienceSpec ? JSON.stringify(audienceSpec) : null,
      displayHomepage: displayHomepage !== false,
      displayStreaming: displayStreaming === true,
      startsAt: new Date().toISOString(),
      expiresAt: typeof expiresAt === "string" && expiresAt ? expiresAt : null,
      active: true,
    });

    if (targetAccountId) {
      await logAdminAudit({ actor: (payload as { profileId?: string }).profileId || "admin", action: "broadcast.message_sent", detail: `Direct in-app message sent to account`, ip: getClientIp(request) });
    } else {
      await logAdminAudit({ actor: (payload as { profileId?: string }).profileId || "admin", action: "broadcast.announcement_sent", detail: `In-app announcement → ${recipientCount ?? "all"} recipient(s)`, ip: getClientIp(request) });
    }

    return successResponse(
      {
        message: targetAccountId
          ? "Message sent to the account"
          : `Announcement sent to ${recipientCount ?? "all"} account(s)`,
      },
      201
    );
  } catch (error) {
    console.error("Admin create message error:", error);
    return errorResponse("Internal server error", 500);
  }
}
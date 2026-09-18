import { NextRequest } from "next/server";
import { db } from "@/db";
import { adminMessages, accounts, messageViews } from "@/db/schema";
import { eq, and, or, isNull, desc, notInArray } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { accountMatchesBroadcastSpec, parseAudienceFilter } from "@/lib/broadcast-targeting";

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

    // Message ids this account has already viewed (persisted server-side so a
    // message pops exactly once per account, even across new sessions/devices).
    const viewed = await db
      .select({ messageId: messageViews.messageId })
      .from(messageViews)
      .where(eq(messageViews.accountId, account.id));
    const viewedIds = viewed.map((v) => v.messageId);

    // Broadcast messages (accountId IS NULL) or messages targeted at this
    // account, excluding any the account has already seen.
    let messages;
    if (viewedIds.length > 0) {
      messages = await db
        .select()
        .from(adminMessages)
        .where(
          and(
            or(isNull(adminMessages.accountId), eq(adminMessages.accountId, account.id)),
            notInArray(adminMessages.id, viewedIds)
          )
        )
        .orderBy(desc(adminMessages.createdAt))
        .limit(50);
    } else {
      messages = await db
        .select()
        .from(adminMessages)
        .where(
          or(isNull(adminMessages.accountId), eq(adminMessages.accountId, account.id))
        )
        .orderBy(desc(adminMessages.createdAt))
        .limit(50);
    }

    const now = Date.now();
    const visible = [];
    for (const m of messages) {
      // Direct (targeted) message: always visible.
      if (m.accountId) {
        visible.push(m);
        continue;
      }
      // Announcement: must be active, not expired, and match the account audience.
      if (m.active === false) continue;
      if (m.expiresAt && new Date(m.expiresAt).getTime() <= now) continue;
      if (m.startsAt && new Date(m.startsAt).getTime() > now) continue;
      const spec = parseAudienceFilter(m.audienceFilter);
      if (spec && !(await accountMatchesBroadcastSpec(account.id, spec))) continue;
      visible.push(m);
    }

    return successResponse({
      messages: visible.map((m) => ({
        id: m.id,
        message: m.message,
        createdAt: m.createdAt,
        broadcast: m.accountId === null,
        title: m.title,
        priority: m.priority || "normal",
      })),
    });
  } catch (error) {
    console.error("Get messages error:", error);
    return errorResponse("Internal server error", 500);
  }
}
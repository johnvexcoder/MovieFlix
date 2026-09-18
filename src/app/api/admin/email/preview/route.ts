import { NextRequest } from "next/server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { resolveBroadcastTarget, type BroadcastTargetSpec } from "@/lib/broadcast-targeting";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/email/preview
 *
 * Resolves an audience and returns how many recipients match (and a tiny
 * sample of usernames) WITHOUT sending anything. Used by the broadcast UI to
 * show "Recipients: N" before the admin confirms.
 */
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
    const target = body?.target as BroadcastTargetSpec | undefined;
    if (!target || typeof target !== "object" || typeof target.mode !== "string") {
      return errorResponse("Invalid audience selection", 400);
    }

    const { ids, count } = await resolveBroadcastTarget(target);
    const sample = await db
      .select({ username: accounts.username, email: accounts.email })
      .from(accounts)
      .where(inArray(accounts.id, ids))
      .limit(8);

    return successResponse({
      count,
      sample: sample.map((s) => ({ username: s.username, hasEmail: Boolean(s.email) })),
    });
  } catch (error) {
    console.error("Broadcast preview error:", error);
    return errorResponse("Internal server error", 500);
  }
}
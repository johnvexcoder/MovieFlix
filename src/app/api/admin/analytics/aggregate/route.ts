import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { forbiddenResponse, unauthorizedResponse, successResponse, errorResponse } from "@/lib/api-response";
import { aggregateRange, backfillAnalytics, todayKey } from "@/lib/analytics-aggregate";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) return unauthorizedResponse();
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) return forbiddenResponse("Admin access required");

    const body = (await request.json().catch(() => ({}))) as { from?: unknown; to?: unknown; full?: unknown };
    if (body.full === true) {
      const result = await backfillAnalytics();
      return successResponse(result);
    }

    const from = typeof body.from === "string" ? body.from : undefined;
    const to = typeof body.to === "string" ? body.to : todayKey();
    if (from !== undefined && (!DATE_KEY.test(from) || !DATE_KEY.test(to))) {
      return errorResponse("from/to must be YYYY-MM-DD dates", 400);
    }

    const result = await aggregateRange(from ?? todayKey(), to, 370);
    return successResponse(result);
  } catch (error) {
    console.error("Analytics aggregate error:", error);
    return errorResponse("Internal server error", 500);
  }
}
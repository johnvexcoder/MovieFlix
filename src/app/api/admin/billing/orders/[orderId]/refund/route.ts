import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { billingOrders } from "@/db/schema";
import { verifyToken } from "@/lib/auth";
import { unauthorizedResponse, forbiddenResponse, errorResponse, successResponse } from "@/lib/api-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) return unauthorizedResponse();
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) return forbiddenResponse("Admin access required");

    const { orderId } = await params;
    const body = (await request.json().catch(() => ({}))) as { amountMinor?: unknown };
    const rawAmount = body.amountMinor;

    const [order] = await db.select().from(billingOrders).where(eq(billingOrders.id, orderId)).limit(1);
    if (!order) return errorResponse("Billing order not found", 404);

    if (order.status !== "PAID") {
      return errorResponse("Only paid orders can be refunded", 400);
    }

    if (Number(order.refundAmountMinor) > 0) {
      return successResponse({
        orderId,
        refundAmountMinor: order.refundAmountMinor,
        refundedAt: order.refundedAt,
        alreadyRefunded: true,
      });
    }

    let amountMinor: number;
    if (rawAmount === undefined || rawAmount === null) {
      amountMinor = order.finalAmountMinor;
    } else if (typeof rawAmount === "number" && Number.isSafeInteger(rawAmount) && rawAmount > 0 && rawAmount <= order.finalAmountMinor) {
      amountMinor = rawAmount;
    } else {
      return errorResponse("amountMinor must be a positive integer not exceeding the order total", 400);
    }

    const now = new Date().toISOString();
    const updated = await db
      .update(billingOrders)
      .set({ refundAmountMinor: amountMinor, refundedAt: now, updatedAt: now })
      .where(eq(billingOrders.id, orderId))
      .run();

    if (updated.changes !== 1) return errorResponse("Refund failed to persist", 500);
    return successResponse({ orderId, refundAmountMinor: amountMinor, refundedAt: now, alreadyRefunded: false });
  } catch (error) {
    console.error("Record refund error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
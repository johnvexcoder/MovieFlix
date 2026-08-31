import { NextRequest } from "next/server";
import { db } from "@/db";
import { paymentSubmissions, accounts, admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function PATCH(
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

    const body = await request.json();
    const { status, extendHours } = body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return errorResponse("Invalid status. Must be 'approved' or 'rejected'", 400);
    }

    const [existing] = await db
      .select()
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.id, id))
      .limit(1);

    if (!existing) {
      return errorResponse("Payment submission not found", 404);
    }

    if (existing.status !== "pending") {
      return errorResponse(`Payment submission is already ${existing.status}`, 400);
    }

    // Get the account to potentially extend
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, existing.accountId))
      .limit(1);

    if (!account) {
      return errorResponse("Associated account not found", 404);
    }

    // Update the payment submission
    const now = new Date().toISOString();
    await db
      .update(paymentSubmissions)
      .set({
        status,
        adminNote: status === "approved" ? `Approved by admin (${payload.profileId})` : `Rejected by admin (${payload.profileId})`,
        reviewedByAdminId: payload.profileId,
        updatedAt: now,
      })
      .where(eq(paymentSubmissions.id, id));

    // If approved and extendHours provided, extend the account expiration
    if (status === "approved" && extendHours && extendHours > 0) {
      const currentExpiry = account.expiresAt ? new Date(account.expiresAt).getTime() : null;
      const nowMs = Date.now();
      let newExpiry: Date;

      if (currentExpiry && currentExpiry > nowMs) {
        // Extend from current expiration
        newExpiry = new Date(currentExpiry + extendHours * 60 * 60 * 1000);
      } else {
        // Extend from now (expired or no expiration)
        newExpiry = new Date(nowMs + extendHours * 60 * 60 * 1000);
      }

      await db
        .update(accounts)
        .set({
          expiresAt: newExpiry.toISOString(),
          isLocked: false,
          updatedAt: now,
        })
        .where(eq(accounts.id, account.id));
    }

    return successResponse({
      message: `Payment submission ${status}`,
      status,
    });
  } catch (error) {
    console.error("Admin review payment submission error:", error);
    return errorResponse("Internal server error", 500);
  }
}

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
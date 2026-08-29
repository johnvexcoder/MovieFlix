import { NextRequest } from "next/server";
import { db } from "@/db";
import { paymentSubmissions, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["pending", "approved", "rejected"];

/**
 * Admin reviews a payment submission.
 *   PATCH { status: "approved"|"rejected", adminNote?, extendHours? }
 *
 * Approving a payment extends the account's expiry by `extendHours`
 * (defaults to 720 hours = 30 days when not specified).
 */
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

    const [submission] = await db
      .select()
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.id, id))
      .limit(1);

    if (!submission) {
      return errorResponse("Payment submission not found", 404);
    }

    const body = await request.json();
    const { status, adminNote, extendHours } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return errorResponse("Status must be 'pending', 'approved' or 'rejected'", 400);
    }

    const now = new Date().toISOString();

    if (status === "approved") {
      const hours = extendHours && Number(extendHours) > 0 ? Number(extendHours) : 720;

      const [account] = await db.select().from(accounts).where(eq(accounts.id, submission.accountId)).limit(1);
      if (!account) {
        return errorResponse("Account not found", 404);
      }

      const base = account.expiresAt && new Date(account.expiresAt) > new Date()
        ? new Date(account.expiresAt)
        : new Date();
      base.setHours(base.getHours() + hours);
      const newExpiresAt = base.toISOString();

      await db
        .update(accounts)
        .set({
          expiresAt: newExpiresAt,
          durationHours: (account.durationHours || 0) + hours,
          updatedAt: now,
        })
        .where(eq(accounts.id, submission.accountId));

      await db
        .update(paymentSubmissions)
        .set({
          status,
          adminNote: typeof adminNote === "string" ? adminNote : "Payment approved",
          reviewedByAdminId: payload.profileId,
          updatedAt: now,
        })
        .where(eq(paymentSubmissions.id, submission.id));

      return successResponse({
        message: `Payment approved. Account extended by ${hours} hours (new expiry ${new Date(newExpiresAt).toLocaleString()}).`,
      });
    }

    await db
      .update(paymentSubmissions)
      .set({
        status,
        adminNote: typeof adminNote === "string" ? adminNote : null,
        reviewedByAdminId: payload.profileId,
        updatedAt: now,
      })
      .where(eq(paymentSubmissions.id, submission.id));

    return successResponse({
      message: status === "rejected" ? "Payment submission rejected." : "Payment submission marked as pending.",
    });
  } catch (error) {
    console.error("Admin review payment error:", error);
    return errorResponse("Internal server error", 500);
  }
}
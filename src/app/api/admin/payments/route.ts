import { NextRequest } from "next/server";
import { db } from "@/db";
import { paymentSubmissions, accounts, paymentMethods } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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

    const submissions = await db
      .select({
        id: paymentSubmissions.id,
        accountId: paymentSubmissions.accountId,
        paymentMethodId: paymentSubmissions.paymentMethodId,
        senderName: paymentSubmissions.senderName,
        senderAccountNumber: paymentSubmissions.senderAccountNumber,
        amount: paymentSubmissions.amount,
        referenceNumber: paymentSubmissions.referenceNumber,
        receiptPath: paymentSubmissions.receiptPath,
        adminNote: paymentSubmissions.adminNote,
        status: paymentSubmissions.status,
        createdAt: paymentSubmissions.createdAt,
        accountUsername: accounts.username,
        methodName: paymentMethods.name,
      })
      .from(paymentSubmissions)
      .leftJoin(accounts, eq(paymentSubmissions.accountId, accounts.id))
      .leftJoin(paymentMethods, eq(paymentSubmissions.paymentMethodId, paymentMethods.id))
      .orderBy(desc(paymentSubmissions.createdAt))
      .limit(200);

    return successResponse({
      submissions: submissions.map((s) => ({
        ...s,
        receiptUrl: s.receiptPath ? `/api/files?file=${encodeURIComponent(s.receiptPath)}` : null,
        iconUrl: null,
        qrUrl: null,
      })),
    });
  } catch (error) {
    console.error("Admin list payments error:", error);
    return errorResponse("Internal server error", 500);
  }
}
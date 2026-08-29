import { NextRequest } from "next/server";
import { db } from "@/db";
import { accounts, paymentMethods, paymentSubmissions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { v4 as uuidv4 } from "uuid";

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

    const submissions = await db
      .select()
      .from(paymentSubmissions)
      .where(eq(paymentSubmissions.accountId, payload.accountId))
      .orderBy(desc(paymentSubmissions.createdAt))
      .limit(50);

    return successResponse({
      submissions: submissions.map((s) => ({
        id: s.id,
        senderName: s.senderName,
        senderAccountNumber: s.senderAccountNumber,
        amount: s.amount,
        referenceNumber: s.referenceNumber,
        status: s.status,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    console.error("Get my payments error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { paymentMethodId, senderName, senderAccountNumber, amount, referenceNumber, receiptPath } = body;

    if (!paymentMethodId || typeof paymentMethodId !== "string") {
      return errorResponse("Payment method is required", 400);
    }
    if (!senderName || typeof senderName !== "string" || !senderName.trim()) {
      return errorResponse("Sender name is required", 400);
    }
    if (!senderAccountNumber || typeof senderAccountNumber !== "string" || !senderAccountNumber.trim()) {
      return errorResponse("Sender account number is required", 400);
    }
    const amountNum = Number(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      return errorResponse("Amount is required and must be greater than zero", 400);
    }
    if (!referenceNumber || typeof referenceNumber !== "string" || !referenceNumber.trim()) {
      return errorResponse("Reference number is required", 400);
    }
    if (!receiptPath || typeof receiptPath !== "string") {
      return errorResponse("Receipt upload is required", 400);
    }

    const [method] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, paymentMethodId)).limit(1);
    if (!method || !method.isActive) {
      return errorResponse("Payment method not found or inactive", 404);
    }

    const now = new Date().toISOString();
    await db.insert(paymentSubmissions).values({
      id: uuidv4(),
      paymentMethodId: method.id,
      accountId: account.id,
      senderName: senderName.trim(),
      senderAccountNumber: senderAccountNumber.trim(),
      amount: Math.round(amountNum * 100) / 100,
      referenceNumber: referenceNumber.trim(),
      receiptPath,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return successResponse(
      {
        message: "Payment submission received. It will normally be processed within 2 hours.",
        status: "pending",
      },
      201
    );
  } catch (error) {
    console.error("Submit payment error:", error);
    return errorResponse("Internal server error", 500);
  }
}
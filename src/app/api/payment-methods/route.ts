import { NextRequest } from "next/server";
import { db } from "@/db";
import { paymentMethods } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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

    const methods = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.isActive, true))
      .orderBy(asc(paymentMethods.sortOrder));

    return successResponse({
      methods: methods.map((m) => ({
        id: m.id,
        name: m.name,
        accountNumber: m.accountNumber,
        iconUrl: m.iconPath ? `/api/files?file=${encodeURIComponent(m.iconPath)}` : null,
        qrUrl: m.qrPath ? `/api/files?file=${encodeURIComponent(m.qrPath)}` : null,
      })),
    });
  } catch (error) {
    console.error("Get payment methods error:", error);
    return errorResponse("Internal server error", 500);
  }
}
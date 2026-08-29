import { NextRequest } from "next/server";
import { db } from "@/db";
import { contactSubmissions, accounts } from "@/db/schema";
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
        id: contactSubmissions.id,
        type: contactSubmissions.type,
        subject: contactSubmissions.subject,
        message: contactSubmissions.message,
        accountId: contactSubmissions.accountId,
        createdAt: contactSubmissions.createdAt,
        accountUsername: accounts.username,
      })
      .from(contactSubmissions)
      .leftJoin(accounts, eq(contactSubmissions.accountId, accounts.id))
      .orderBy(desc(contactSubmissions.createdAt))
      .limit(200);

    return successResponse({ submissions });
  } catch (error) {
    console.error("Admin list contact submissions error:", error);
    return errorResponse("Internal server error", 500);
  }
}
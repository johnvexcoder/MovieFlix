import { NextRequest } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "@/lib/api-response";
import { findValidInviteByToken } from "@/lib/admin-invite";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) return errorResponse("This administrator invitation is invalid or has expired.", 400);

    const result = await findValidInviteByToken(token);
    if (!result || result.state !== "valid") {
      const state = result?.state;
      if (state === "used") return errorResponse("used", 410);
      if (state === "expired") return errorResponse("expired", 410);
      return errorResponse("This administrator invitation is invalid or has expired.", 400);
    }

    const [admin] = await db.select().from(admins).where(eq(admins.id, result.invite.adminId)).limit(1);
    if (!admin) return errorResponse("This administrator invitation is invalid or has expired.", 400);
    if (admin.status !== "pending_setup") return errorResponse("used", 410);

    const maskedEmail = admin.email
      ? `${admin.email.slice(0, 1)}***@${admin.email.split("@")[1] || ""}`
      : null;

    return successResponse({ username: admin.username, email: maskedEmail });
  } catch (error) {
    console.error("Validate admin invite error:", error);
    return errorResponse("This administrator invitation is invalid or has expired.", 400);
  }
}
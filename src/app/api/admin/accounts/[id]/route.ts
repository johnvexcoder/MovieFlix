import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, hashPassword } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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

    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1);

    if (!account) {
      return errorResponse("Account not found", 404);
    }

    const body = await request.json();
    const { additionalHours, newPassword } = body;

    if (newPassword !== undefined) {
      if (
        typeof newPassword !== "string" ||
        newPassword.length < 6
      ) {
        return errorResponse("Password must be at least 6 characters", 400);
      }

      const passwordHash = await hashPassword(newPassword);
      await db
        .update(accounts)
        .set({
          passwordHash,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, id));

      return successResponse({
        account: {
          id: account.id,
          username: account.username,
          passwordReset: true,
        },
      });
    }

    if (!additionalHours || additionalHours <= 0) {
      return errorResponse("Additional hours must be a positive number", 400);
    }

    // Calculate new expiry
    let newExpiresAt: string | null = null;
    if (account.expiresAt) {
      // Extend from current expiry
      const current = new Date(account.expiresAt);
      current.setHours(current.getHours() + additionalHours);
      newExpiresAt = current.toISOString();
    } else {
      // Account never expires, set expiry from now
      const current = new Date();
      current.setHours(current.getHours() + additionalHours);
      newExpiresAt = current.toISOString();
    }

    await db
      .update(accounts)
      .set({
        expiresAt: newExpiresAt,
        durationHours: (account.durationHours || 0) + additionalHours,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, id));

    return successResponse({
      account: {
        id: account.id,
        username: account.username,
        expiresAt: newExpiresAt,
        isActive: new Date(newExpiresAt) > new Date(),
      },
    });
  } catch (error) {
    console.error("Update account error:", error);
    return errorResponse("Internal server error", 500);
  }
}
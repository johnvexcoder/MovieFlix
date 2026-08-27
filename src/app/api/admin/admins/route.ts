import { NextRequest } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { like } from "drizzle-orm";
import { verifyToken, hashPassword } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { randomUUID } from "crypto";

function requireAdmin(request: NextRequest) {
  const adminToken = request.cookies.get("admin_token")?.value;
  if (!adminToken) return null;
  return adminToken;
}

export async function GET(request: NextRequest) {
  try {
    const adminToken = requireAdmin(request);
    if (!adminToken) return errorResponse("Unauthorized", 401);

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const allAdmins = await db
      .select({
        id: admins.id,
        username: admins.username,
        createdAt: admins.createdAt,
      })
      .from(admins)
      .orderBy(admins.createdAt);

    return successResponse({ admins: allAdmins });
  } catch (error) {
    console.error("List admins error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminToken = requireAdmin(request);
    if (!adminToken) return errorResponse("Unauthorized", 401);

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || typeof username !== "string" || !username.trim()) {
      return errorResponse("Username is required", 400);
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return errorResponse("Password must be at least 6 characters", 400);
    }

    const cleanUsername = username.trim();

    const existing = await db
      .select({ id: admins.id })
      .from(admins)
      .where(like(admins.username, cleanUsername))
      .limit(1);

    if (existing.length > 0) {
      return errorResponse("Username already taken", 409);
    }

    const now = new Date().toISOString();
    const adminId = randomUUID();
    const passwordHash = await hashPassword(password);

    await db.insert(admins).values({
      id: adminId,
      username: cleanUsername,
      passwordHash,
      createdAt: now,
    });

    return successResponse({
      admin: {
        id: adminId,
        username: cleanUsername,
        createdAt: now,
      },
    });
  } catch (error) {
    console.error("Create admin error:", error);
    return errorResponse("Internal server error", 500);
  }
}
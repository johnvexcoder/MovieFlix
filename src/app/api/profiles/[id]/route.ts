import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { profiles, accounts, watchHistory, sessions, profileSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, hashPin } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);

    if (!profile) {
      return errorResponse("Profile not found", 404);
    }

    // Ensure profile belongs to authenticated account
    if (profile.accountId !== payload.accountId) {
      return errorResponse("Access denied", 403);
    }

    const body = await request.json();
    const { name, pin, avatarUrl } = body;

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined && typeof name === "string" && name.trim().length > 0) {
      updates.name = name.trim();
    }

    if (avatarUrl !== undefined) {
      updates.avatarUrl = typeof avatarUrl === "string" && avatarUrl.length > 0 ? avatarUrl : null;
    }

    if (pin === null) {
      updates.pinHash = null;
    } else if (pin && typeof pin === "string" && pin.length === 4) {
      updates.pinHash = await hashPin(pin);
    } else if (pin !== undefined) {
      return errorResponse("PIN must be 4 digits", 400);
    }

    await db
      .update(profiles)
      .set(updates)
      .where(eq(profiles.id, id));

    return successResponse({ message: "Profile updated" });
  } catch (error) {
    console.error("Update profile error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);

    if (!profile) {
      return errorResponse("Profile not found", 404);
    }

    // Ensure profile belongs to authenticated account
    if (profile.accountId !== payload.accountId) {
      return errorResponse("Access denied", 403);
    }

    // Cannot delete main profile
    if (profile.isMainProfile) {
      return errorResponse("Cannot delete the main profile", 400);
    }

    // Cascade delete profile child data
    await db.delete(watchHistory).where(eq(watchHistory.profileId, id));
    await db.delete(sessions).where(eq(sessions.profileId, id));
    await db.delete(profileSettings).where(eq(profileSettings.profileId, id));
    await db
      .delete(profiles)
      .where(eq(profiles.id, id));

    return successResponse({ message: "Profile deleted successfully" });
  } catch (error) {
    console.error("Delete profile error:", error);
    return errorResponse("Internal server error", 500);
  }
}
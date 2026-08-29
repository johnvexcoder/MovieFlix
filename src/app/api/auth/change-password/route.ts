import { NextRequest } from "next/server";
import { db } from "@/db";
import { accounts, profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, comparePassword, hashPassword, generateAccessToken, extractIpSubnet, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { revokeTokenVersion, setRateLimit } from "@/lib/redis";

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

    const ip = getClientIp(request);
    const rateLimit = await setRateLimit(`ratelimit:change-password:${payload.accountId}`, 60 * 1000, 3);
    if (!rateLimit.allowed) {
      return errorResponse("Too many attempts. Please try again later.", 429);
    }

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, payload.profileId)).limit(1);
    if (!profile) {
      return errorResponse("Profile not found", 404);
    }
    const [account] = await db.select().from(accounts).where(eq(accounts.id, profile.accountId)).limit(1);
    if (!account) {
      return errorResponse("Account not found", 404);
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      return errorResponse("Current and new passwords are required", 400);
    }
    if (newPassword.length < 6) {
      return errorResponse("New password must be at least 6 characters", 400);
    }

    const isValid = await comparePassword(currentPassword, account.passwordHash);
    if (!isValid) {
      return errorResponse("Current password is incorrect", 401);
    }

    if (currentPassword === newPassword) {
      return errorResponse("New password must be different from the current password", 400);
    }

    const passwordHash = await hashPassword(newPassword);

    await db
      .update(accounts)
      .set({
        passwordHash,
        mustChangePassword: false,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, account.id));

    // Rotate the refresh token version for this profile so other devices are
    // logged out after a credential change.
    await revokeTokenVersion(payload.profileId);

    // Re-issue a fresh access token so the current session remains valid with
    // the must-change flag cleared downstream.
    const newAccessToken = generateAccessToken({
      profileId: payload.profileId,
      accountId: account.id,
      isAdmin: false,
      fingerprint: accessToken ? extractIpSubnet(ip) : "0.0.0.0",
    });

    const response = successResponse({ message: "Password updated" });
    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    response.cookies.set("access_token", newAccessToken, {
      httpOnly: true,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Change password error:", error);
    return errorResponse("Internal server error", 500);
  }
}

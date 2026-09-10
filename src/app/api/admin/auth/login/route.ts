import { NextRequest } from "next/server";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { sql } from "drizzle-orm";
import { comparePassword, generateAccessToken, generateRefreshToken, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { setRateLimit, getTokenVersion, setSession } from "@/lib/redis";
import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/email";
import { adminCodeEmail, generateEmailCode, securityHash } from "@/lib/admin-two-factor";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    
    // Rate limit: 5 login attempts per 15 minutes per IP
    const rateLimit = await setRateLimit(`ratelimit:admin_login:${ip}`, 15 * 60 * 1000, 5);
    if (!rateLimit.allowed) {
      return errorResponse("Too many login attempts. Please try again later.", 429);
    }

    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!username || !password) {
      return errorResponse("Username and password are required", 400);
    }

    // Find admin
    const [admin] = await db
      .select()
      .from(admins)
      .where(sql`lower(${admins.username}) = ${username}`)
      .limit(1);

    if (!admin) {
      return errorResponse("Invalid admin username or password", 401);
    }

    // Verify password
    const isValid = await comparePassword(password, admin.passwordHash);
    if (!isValid) {
      return errorResponse("Invalid admin username or password", 401);
    }

    if (admin.twoFactorEnabled) {
      if (!admin.email) return errorResponse("Two-step verification requires an administrator email. Contact another administrator.", 403);
      const challengeToken = randomBytes(32).toString("hex");
      const code = generateEmailCode();
      await setSession(`admin-2fa:${challengeToken}`, { adminId: admin.id, codeHash: securityHash(code), attempts: 0 }, 10 * 60);
      const delivered = await sendEmail({ to: admin.email, subject: "Your MovieFlix admin verification code", html: adminCodeEmail(code) });
      if (!delivered) return errorResponse("Verification email could not be delivered. Check the SMTP configuration.", 503);
      const [local, domain = ""] = admin.email.split("@");
      const maskedEmail = `${local.slice(0, 2)}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
      return successResponse({ requiresTwoFactor: true, challengeToken, maskedEmail });
    }

    // Generate admin token
    const accessToken = generateAccessToken({
      profileId: admin.id,
      accountId: "admin",
      isAdmin: true,
      fingerprint: "admin",
    });

    // Long-lived session refresh token (7 days)
    const tokenVersion = await getTokenVersion(admin.id);
    const sessionToken = generateRefreshToken(admin.id, tokenVersion);

    // Build response
    const response = successResponse({
      admin: {
        id: admin.id,
        username: admin.username,
      },
      accessToken,
    });

    // Set cookies (secure only if connection is HTTPS)
    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

    response.cookies.set("admin_token", accessToken, {
      httpOnly: true,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 15 * 60, // 15 minutes
      path: "/",
    });

    response.cookies.set("admin_session", sessionToken, {
      httpOnly: true,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal server error", 500);
  }
}

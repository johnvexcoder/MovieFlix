import { NextRequest } from "next/server";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { db } from "@/db";
import { accounts, profiles, signupSessions } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { comparePassword, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { setRateLimit } from "@/lib/redis";
import { hashSignupToken } from "@/lib/registration";
import { reconcilePayMongoOrders } from "@/services/billing/service";
import { establishAccountSession } from "@/lib/user-session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!username || !password) {
      return errorResponse("Username and password are required", 400);
    }

    const ip = getClientIp(request);

    // Rate limit: 5 login attempts per 15 minutes per IP + username. Keying on
    // the pair (rather than IP alone) keeps a single compromised/misconfigured
    // proxy from trivially defeating the limit via spoofed X-Forwarded-For.
    const rateKey = `ratelimit:account-login:${ip}:${String(username).toLowerCase()}`;
    const rateLimit = await setRateLimit(rateKey, 15 * 60 * 1000, 5);
    if (!rateLimit.allowed) {
      return errorResponse("Too many login attempts. Please try again later.", 429);
    }

    // Find account by username or email
    let [account] = await db
      .select()
      .from(accounts)
      .where(
        or(
          sql`lower(${accounts.username}) = ${username}`,
          eq(accounts.email, username)
        )
      )
      .limit(1);

    if (!account) {
      return errorResponse("Invalid username or password", 401);
    }

    // Verify password
    const isValid = await comparePassword(password, account.passwordHash);
    if (!isValid) {
      return errorResponse("Invalid username or password", 401);
    }

    await reconcilePayMongoOrders(account.id);
    [account] = await db.select().from(accounts).where(eq(accounts.id, account.id)).limit(1);

    if (account.registrationStatus === "pending" || account.registrationStatus === "awaiting_payment_approval") {
      if (account.registrationStatus !== "pending") await db.update(accounts).set({ registrationStatus: "pending", updatedAt: new Date().toISOString() }).where(eq(accounts.id, account.id));
      const signupToken = crypto.randomBytes(32).toString("base64url");
      await db.insert(signupSessions).values({
        id: uuidv4(), accountId: account.id, tokenHash: hashSignupToken(signupToken),
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(), createdAt: new Date().toISOString(),
      });
      return successResponse({ requiresPayment: true, signupToken, registrationStatus: "pending" });
    }
    if (account.isLocked) return errorResponse("This account has been locked. Please contact support.", 403);

    // Check if account is expired
    if (account.expiresAt) {
      const expiresAt = new Date(account.expiresAt);
      if (expiresAt < new Date()) {
        return errorResponse("Account has expired", 403);
      }
    }

    // Get profiles for this account
    const accountProfiles = await db
      .select()
      .from(profiles)
      .where(eq(profiles.accountId, account.id));

    const mainProfile = accountProfiles.find((p) => p.isMainProfile) || accountProfiles[0];

    if (!mainProfile) {
      return errorResponse("No profiles found for this account", 404);
    }

    // Session enforcement + token minting (shared with the TV QR login flow so
    // both obey identical active-session and per-device replacement rules).
    const established = await establishAccountSession(request, account, accountProfiles);
    if (!established.ok) {
      if (established.reason === "max_sessions") {
        return errorResponse(
          `Your account has reached the maximum of ${established.maxSessions} active sessions. End a session on another device, or contact support to raise the limit.`,
          429
        );
      }
      return errorResponse("No profiles found for this account", 404);
    }

    const { accessToken, refreshToken, sessionId, deviceId, isHttps } = established;

    const response = successResponse({
      account: {
        id: account.id,
        username: account.username,
        expiresAt: account.expiresAt,
        mustChangePassword: Boolean(account.mustChangePassword),
      },
      profiles: accountProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        isMainProfile: p.isMainProfile,
      })),
      accessToken,
    });

    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 15 * 60,
      path: "/",
    });

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    response.cookies.set("device_id", deviceId, {
      httpOnly: false,
      secure: Boolean(isHttps),
      sameSite: "lax",
      maxAge: 365 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Account login error:", error);
    return errorResponse(error instanceof Error ? error.message : "Internal server error", 500);
  }
}

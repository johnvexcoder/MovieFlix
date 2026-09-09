import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { errorResponse, successResponse } from "@/lib/api-response";
import { generateAccessToken, generateRefreshToken, getClientIp } from "@/lib/auth";
import { deleteSession, getSession, getTokenVersion, setRateLimit, setSession } from "@/lib/redis";
import { securityHash } from "@/lib/admin-two-factor";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = await setRateLimit(`ratelimit:admin_2fa:${ip}`, 15 * 60 * 1000, 10);
    if (!limit.allowed) return errorResponse("Too many verification attempts. Try again later.", 429);
    const { challengeToken, code } = await request.json();
    if (typeof challengeToken !== "string" || typeof code !== "string") return errorResponse("Challenge and code are required", 400);
    const key = `admin-2fa:${challengeToken}`;
    const challenge = await getSession(key);
    if (!challenge || typeof challenge.adminId !== "string" || typeof challenge.codeHash !== "string") return errorResponse("Verification code expired. Sign in again.", 401);
    const [admin] = await db.select().from(admins).where(eq(admins.id, challenge.adminId)).limit(1);
    if (!admin || !admin.twoFactorEnabled) return errorResponse("Verification is unavailable", 401);

    const submittedHash = securityHash(code);
    let valid = submittedHash === challenge.codeHash;
    let recoveryHashes: string[] = [];
    try { recoveryHashes = JSON.parse(admin.recoveryCodesHash || "[]"); } catch { recoveryHashes = []; }
    const recoveryIndex = recoveryHashes.indexOf(submittedHash);
    if (!valid && recoveryIndex >= 0) {
      valid = true;
      recoveryHashes.splice(recoveryIndex, 1);
      await db.update(admins).set({ recoveryCodesHash: JSON.stringify(recoveryHashes) }).where(eq(admins.id, admin.id));
    }
    if (!valid) {
      const attempts = Number(challenge.attempts || 0) + 1;
      if (attempts >= 5) await deleteSession(key);
      else await setSession(key, { ...challenge, attempts }, 10 * 60);
      return errorResponse(attempts >= 5 ? "Too many attempts. Sign in again." : "Invalid verification or recovery code", 401);
    }
    await deleteSession(key);
    const accessToken = generateAccessToken({ profileId: admin.id, accountId: "admin", isAdmin: true, fingerprint: "admin" });
    const sessionToken = generateRefreshToken(admin.id, await getTokenVersion(admin.id));
    const response = successResponse({ admin: { id: admin.id, username: admin.username }, accessToken });
    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    response.cookies.set("admin_token", accessToken, { httpOnly: true, secure: isHttps, sameSite: "lax", maxAge: 15 * 60, path: "/" });
    response.cookies.set("admin_session", sessionToken, { httpOnly: true, secure: isHttps, sameSite: "lax", maxAge: 7 * 24 * 60 * 60, path: "/" });
    return response;
  } catch (error) {
    console.error("Admin 2FA verification error:", error);
    return errorResponse("Could not verify the code", 500);
  }
}

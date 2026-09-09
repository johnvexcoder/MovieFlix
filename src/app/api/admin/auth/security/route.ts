import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { errorResponse, successResponse } from "@/lib/api-response";
import { comparePassword, verifyToken } from "@/lib/auth";
import { adminCodeEmail, generateEmailCode, generateRecoveryCodes, securityHash } from "@/lib/admin-two-factor";
import { sendEmail } from "@/lib/email";
import { deleteSession, getSession, setSession } from "@/lib/redis";

async function current(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload?.isAdmin) return null;
  const [admin] = await db.select().from(admins).where(eq(admins.id, payload.profileId)).limit(1);
  return admin || null;
}

export async function GET(request: NextRequest) {
  const admin = await current(request);
  if (!admin) return errorResponse("Authentication required", 401);
  return successResponse({ email: admin.email, twoFactorEnabled: admin.twoFactorEnabled, recoveryCodesRemaining: (() => { try { return JSON.parse(admin.recoveryCodesHash || "[]").length; } catch { return 0; } })() });
}

export async function POST(request: NextRequest) {
  try {
    const admin = await current(request);
    if (!admin) return errorResponse("Authentication required", 401);
    const body = await request.json();
    if (body.action === "begin-enable") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) return errorResponse("Enter a valid recovery email", 400);
      if (!(await comparePassword(String(body.password || ""), admin.passwordHash))) return errorResponse("Current password is incorrect", 401);
      const duplicate = await db.select({ id: admins.id }).from(admins).where(and(eq(admins.email, email), ne(admins.id, admin.id))).limit(1);
      if (duplicate.length) return errorResponse("That email is already assigned to an administrator", 409);
      const code = generateEmailCode();
      const setupToken = randomBytes(32).toString("hex");
      await setSession(`admin-2fa-setup:${setupToken}`, { adminId: admin.id, email, codeHash: securityHash(code), attempts: 0 }, 10 * 60);
      if (!(await sendEmail({ to: email, subject: "Verify your MovieFlix admin email", html: adminCodeEmail(code) }))) {
        await deleteSession(`admin-2fa-setup:${setupToken}`);
        return errorResponse("Verification email could not be delivered. Check SMTP settings.", 503);
      }
      return successResponse({ setupToken });
    }
    if (body.action === "confirm-enable") {
      const key = `admin-2fa-setup:${String(body.setupToken || "")}`;
      const setup = await getSession(key);
      if (!setup || setup.adminId !== admin.id || typeof setup.email !== "string" || typeof setup.codeHash !== "string") return errorResponse("Verification expired. Start again.", 401);
      if (securityHash(String(body.code || "")) !== setup.codeHash) return errorResponse("Invalid verification code", 401);
      const recoveryCodes = generateRecoveryCodes();
      await db.update(admins).set({ email: setup.email, twoFactorEnabled: true, recoveryCodesHash: JSON.stringify(recoveryCodes.map(securityHash)) }).where(eq(admins.id, admin.id));
      await deleteSession(key);
      return successResponse({ recoveryCodes });
    }
    if (body.action === "disable") {
      if (!(await comparePassword(String(body.password || ""), admin.passwordHash))) return errorResponse("Current password is incorrect", 401);
      await db.update(admins).set({ twoFactorEnabled: false, recoveryCodesHash: null }).where(eq(admins.id, admin.id));
      return successResponse({ disabled: true });
    }
    return errorResponse("Unsupported security action", 400);
  } catch (error) {
    console.error("Admin security settings error:", error);
    return errorResponse("Could not update administrator security", 500);
  }
}

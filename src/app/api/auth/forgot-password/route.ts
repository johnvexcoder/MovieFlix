import { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@/db";
import { accounts, passwordResetTokens } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { setRateLimit } from "@/lib/redis";
import { sendEmail, getSmtpSettings } from "@/lib/email";
import { forgotPasswordEmail } from "@/lib/email-templates";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await setRateLimit(`ratelimit:forgot-password:${ip}`, 15 * 60 * 1000, 5);
    if (!rateLimit.allowed) {
      return errorResponse("Too many requests. Please try again later.", 429);
    }

    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== "string") {
      return errorResponse("Username or email is required", 400);
    }

    const [account] = await db
      .select()
      .from(accounts)
      .where(or(eq(accounts.username, username), eq(accounts.email, username)))
      .limit(1);

    // Always return the same message to avoid account enumeration.
    const genericMessage = "If that account exists, a password reset link has been sent.";

    if (!account || !account.email) {
      return successResponse({ message: genericMessage });
    }

    // Generate a one-time token, store only its hash.
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    await db.insert(passwordResetTokens).values({
      id: uuidv4(),
      accountId: account.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      createdAt: new Date().toISOString(),
    });

    const resetLink = `${process.env.APP_PUBLIC_URL || "http://localhost:9000"}/reset-password?token=${token}`;

    const smtp = await getSmtpSettings();
    const delivered = await sendEmail({
      to: account.email,
      subject: "Reset your MovieFlix password",
      html: forgotPasswordEmail({ username: account.username, resetLink }),
    });

    if (!delivered && (!smtp.host || !smtp.user || !smtp.pass)) {
      // No SMTP configured: log the link for the operator and return a generic
      // message. Do NOT return the link to the client.
      console.warn(`[forgot-password] SMTP not configured. Reset link for ${account.username}: ${resetLink}`);
      return successResponse({ message: genericMessage });
    }

    if (!delivered) {
      return errorResponse("Failed to send reset email. Please try again later or contact support.", 500);
    }

    return successResponse({ message: genericMessage });
  } catch (error) {
    console.error("Forgot password error:", error);
    return errorResponse("Internal server error", 500);
  }
}

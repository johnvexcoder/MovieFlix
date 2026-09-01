import { NextRequest } from "next/server";
import { db } from "@/db";
import { profiles, accounts, contactSubmissions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken, getClientIp } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { setRateLimit } from "@/lib/redis";
import { sendEmail } from "@/lib/email";
import { submissionConfirmationEmail } from "@/lib/email-templates";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["report", "feedback", "suggestion"];

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await setRateLimit(`ratelimit:contact:${ip}`, 60 * 60 * 1000, 10);
    if (!rateLimit.allowed) {
      return errorResponse("Too many submissions. Please try again later.", 429);
    }

    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Not authenticated", 401);
    }
    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    const body = await request.json();
    const { type, subject, message } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return errorResponse("Type must be 'report', 'feedback' or 'suggestion'", 400);
    }
    if (!message || typeof message !== "string" || message.trim().length < 3) {
      return errorResponse("Message is required (min 3 characters)", 400);
    }
    if (message.length > 5000) {
      return errorResponse("Message is too long (max 5000 characters)", 400);
    }

    const subjectValue =
      typeof subject === "string" && subject.trim() ? subject.trim() : null;

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, payload.profileId)).limit(1);
    const accountId = profile ? profile.accountId : (payload.accountId ?? null);

    await db.insert(contactSubmissions).values({
      id: uuidv4(),
      type,
      subject: subjectValue,
      message: message.trim(),
      accountId,
      profileId: profile ? profile.id : null,
      createdAt: new Date().toISOString(),
    });

    // Auto-reply: send the user a confirmation that we received their
    // submission (report / suggestion / feedback). Best-effort — never fails
    // the request if SMTP is not configured.
    if (accountId) {
      try {
        const [account] = await db
          .select({ username: accounts.username, email: accounts.email })
          .from(accounts)
          .where(eq(accounts.id, accountId))
          .limit(1);

        if (account?.email) {
          await sendEmail({
            to: account.email,
            subject: "We received your submission - MovieFlix",
            html: submissionConfirmationEmail({
              username: account.username || "there",
              type,
              subject: subjectValue,
            }),
          });
        }
      } catch (e) {
        console.error("Auto-reply email error:", e);
      }
    }

    return successResponse({ message: "Thank you! Your submission has been received." }, 201);
  } catch (error) {
    console.error("Contact submission error:", error);
    return errorResponse("Internal server error", 500);
  }
}
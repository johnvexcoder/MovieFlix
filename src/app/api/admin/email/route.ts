import { NextRequest } from "next/server";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sendEmail } from "@/lib/email";
import { broadcastEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/email
 *
 * Sends an email to all users (recipients="all") or to a single user
 * (recipients=<accountId>). The message template greets each user by name, so
 * a single blast reaches the whole list without writing each email by hand.
 *
 * Body: { recipients: "all" | string, subject: string, message: string }
 */
export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const body = await request.json();
    const { recipients, subject, message } = body;

    if (!subject || typeof subject !== "string" || subject.trim().length < 1) {
      return errorResponse("Subject is required", 400);
    }
    if (!message || typeof message !== "string" || message.trim().length < 1) {
      return errorResponse("Message is required", 400);
    }
    if (subject.trim().length > 200) {
      return errorResponse("Subject is too long (max 200 characters)", 400);
    }
    if (message.trim().length > 10000) {
      return errorResponse("Message is too long (max 10000 characters)", 400);
    }

    // Resolve the recipient accounts.
    let targetIds: string[] = [];
    if (recipients === "all") {
      const all = await db
        .select({ id: accounts.id, email: accounts.email, username: accounts.username })
        .from(accounts);
      targetIds = all.map((a) => a.id);
    } else if (typeof recipients === "string" && recipients) {
      targetIds = [recipients];
    } else {
      return errorResponse("Invalid recipients. Use 'all' or a single account id.", 400);
    }

    const targets = await db
      .select({ id: accounts.id, email: accounts.email, username: accounts.username })
      .from(accounts);

    const withEmail = targets.filter((a) => targetIds.includes(a.id) && a.email);

    if (withEmail.length === 0) {
      return errorResponse("No recipients have an email address on file.", 400);
    }

    let sent = 0;
    const errors: string[] = [];

    for (const account of withEmail) {
      const ok = await sendEmail({
        to: account.email!,
        subject: subject.trim(),
        html: broadcastEmail({
          username: account.username || "there",
          subject: subject.trim(),
          message: message.trim(),
        }),
      });
      if (ok) {
        sent++;
      } else {
        errors.push(account.username || account.id);
      }
    }

    return successResponse({
      sent,
      total: withEmail.length,
      failed: errors,
      message: `Email sent to ${sent} recipient(s).`,
    });
  } catch (error) {
    console.error("Admin mass email error:", error);
    return errorResponse("Internal server error", 500);
  }
}

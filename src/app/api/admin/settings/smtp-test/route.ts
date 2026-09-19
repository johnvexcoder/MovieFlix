import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sendEmail, getSmtpSettings } from "@/lib/email";
import { emailLayout } from "@/lib/email-templates";
import { db } from "@/db";
import { admins, appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { logAdminAudit } from "@/lib/admin-audit";

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("admin_token")?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload?.isAdmin) return errorResponse("Admin access required", 403);

    const [admin] = await db.select().from(admins).where(eq(admins.id, payload.profileId)).limit(1);
    const { to } = await request.json();
    const recipient = (typeof to === "string" && to.trim()) ? to.trim() : (admin?.email || "");

    const config = await getSmtpSettings();
    if (!config.host || !config.user || !config.pass || !config.port) {
      return errorResponse("SMTP is not fully configured.", 400);
    }
    if (!recipient) {
      return errorResponse("A recipient email is required.", 400);
    }

    const ok = await sendEmail({
      to: recipient,
      subject: "MovieFlix — SMTP test",
      html: emailLayout({
        title: "SMTP test",
        bodyHtml: "<p>If you received this email, your SMTP configuration is working correctly.</p>",
      }),
    });
    if (!ok) {
      await db.update(appSettings).set({ value: "false" }).where(eq(appSettings.key, "smtp_tested"));
      return errorResponse("SMTP test email could not be sent. Check the server logs for details.", 502);
    }

    // Persist tested state.
    await db.insert(appSettings).values({ key: "smtp_tested", value: "true" }).onConflictDoUpdate({ target: appSettings.key, set: { value: "true" } });
    await logAdminAudit({ adminId: admin?.id, actor: admin?.username, action: "settings.smtp_tested", detail: "SMTP test email sent", ip: "" });
    return successResponse({ message: `Test email sent to ${recipient}.` });
  } catch (error) {
    console.error("SMTP test error:", error);
    return errorResponse("Could not send SMTP test", 500);
  }
}
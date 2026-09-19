import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { getSmtpSettings } from "@/lib/email";
import { getTelegramConfig } from "@/lib/telegram";
import { getSetting } from "@/lib/app-settings";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Server-side status derivation for the System Settings control plane.
 * Every status reflects REAL persisted configuration, never local UI state.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("admin_token")?.value;
    const payload = token ? await verifyToken(token) : null;
    if (!payload?.isAdmin) return errorResponse("Admin access required", 403);

    const [admin] = await db.select().from(admins).where(eq(admins.id, payload.profileId)).limit(1);

    const smtp = await getSmtpSettings();
    const smtpConfigured = Boolean(smtp.host && smtp.user && smtp.pass && smtp.port && smtp.from);
    const smtpTested = (await getSetting<string>("smtp_tested", "false")) === "true";

    const tg = await getTelegramConfig();
    const telegramConfigured = Boolean(tg.botToken && tg.adminChatId);
    const telegramTested = (await getSetting<string>("telegram_tested", "false")) === "true";

    let recoveryCodesRemaining = 0;
    if (admin?.recoveryCodesHash) {
      try { recoveryCodesRemaining = JSON.parse(admin.recoveryCodesHash).length; } catch { recoveryCodesRemaining = 0; }
    }

    const paymongoConfigured = Boolean(process.env.PAYMONGO_PUBLIC_KEY && process.env.PAYMONGO_SECRET_KEY);
    const paymongoWebhookConfigured = Boolean(process.env.PAYMONGO_WEBHOOK_SECRET);

    return successResponse({
      smtp: { configured: smtpConfigured, tested: smtpTested },
      telegram: { configured: telegramConfigured, tested: telegramTested },
      recoveryEmail: { configured: Boolean(admin?.email), verified: Boolean(admin?.email) },
      twoFactor: { enabled: Boolean(admin?.twoFactorEnabled) },
      recoveryCodes: { configured: recoveryCodesRemaining > 0, remaining: recoveryCodesRemaining },
      paymongo: { configured: paymongoConfigured, webhookConfigured: paymongoWebhookConfigured },
    });
  } catch (error) {
    console.error("Settings status error:", error);
    return errorResponse("Internal server error", 500);
  }
}
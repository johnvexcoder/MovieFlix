import { NextRequest } from "next/server";
import { db } from "@/db";
import { accounts, appSettings } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Not authenticated", 401);
    }
    const payload = await verifyToken(accessToken);
    if (!payload) {
      return errorResponse("Invalid token", 401);
    }

    const settings = await db
      .select()
      .from(appSettings)
      .where(inArray(appSettings.key, ["reminder_days", "reminder_message"]));

    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value || "";

    const reminderDays = parseInt(settingsMap["reminder_days"] || "3", 10);
    const reminderMessage =
      settingsMap["reminder_message"] ||
      "Your subscription is expiring soon. Please renew your account to continue watching.";

    const [account] = await db
      .select({ expiresAt: accounts.expiresAt })
      .from(accounts)
      .where(eq(accounts.id, payload.accountId))
      .limit(1);

    return successResponse({
      reminderDays,
      reminderMessage,
      expiresAt: account?.expiresAt || null,
    });
  } catch (error) {
    console.error("Reminder error:", error);
    return errorResponse("Internal server error", 500);
  }
}

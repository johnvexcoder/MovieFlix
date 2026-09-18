import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sendTelegramMessage } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) return errorResponse("Unauthorized", 401);
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) return errorResponse("Admin access required", 403);

    const ok = await sendTelegramMessage("✅ MovieFlix Admin — Telegram Admin Assistant is configured and working.");
    if (!ok) return errorResponse("Telegram message could not be sent. Check the bot token and admin chat ID.", 400);
    return successResponse({ message: "Test Telegram message sent to the Main Admin." });
  } catch (error) {
    console.error("Telegram test error:", error);
    return errorResponse("Could not test Telegram", 500);
  }
}
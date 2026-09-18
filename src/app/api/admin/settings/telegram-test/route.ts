import { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { sendTelegramMessageDetailed } from "@/lib/telegram";

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) return errorResponse("Unauthorized", 401);
    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) return errorResponse("Admin access required", 403);

    const result = await sendTelegramMessageDetailed("MovieFlix Admin Assistant\nTelegram integration test successful.");
    if (!result.ok) {
      // The raw detail is logged server-side; the UI gets a clear, friendly reason.
      return errorResponse(result.error || "Telegram message could not be sent.", 400);
    }
    return successResponse({ message: "Test Telegram message sent to the Main Admin." });
  } catch (error) {
    console.error("Telegram test error:", error);
    return errorResponse("Could not test Telegram", 500);
  }
}
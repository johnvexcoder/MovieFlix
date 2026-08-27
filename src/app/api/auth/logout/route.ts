import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/redis";
import { successResponse } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const sessionId = request.headers
      .get("cookie")
      ?.match(/session_id=([^;]+)/)?.[1];

    if (sessionId) {
      await deleteSession(sessionId);
    }

    const response = successResponse({ message: "Logged out" });

    // Clear cookies
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = "Path=/; HttpOnly; SameSite=Lax; Max-Age=0" + (isProduction ? "; Secure" : "");

    response.headers.set("Set-Cookie", [
      `access_token=; ${cookieOptions}`,
      `refresh_token=; ${cookieOptions}`,
      `session_id=; ${cookieOptions}`,
    ].join(", "));

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

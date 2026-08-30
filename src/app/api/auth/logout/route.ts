import { NextRequest, NextResponse } from "next/server";
import { successResponse } from "@/lib/api-response";
import { verifyToken, verifyRefreshToken } from "@/lib/auth";
import { revokeTokenVersion, removeActiveSession } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    // Remove the active Redis session so the profile's session slot frees up
    // immediately (single-session-per-profile enforcement counts sessions here).
    const refreshToken = request.cookies.get("refresh_token")?.value;
    const accessToken = request.cookies.get("access_token")?.value;

    if (refreshToken) {
      const payload = await verifyRefreshToken(refreshToken);
      if (payload) {
        await revokeTokenVersion(payload.profileId);
        if (payload.sessionId) {
          await removeActiveSession(payload.profileId, payload.sessionId);
        }
      }
    } else if (accessToken) {
      const payload = await verifyToken(accessToken);
      if (payload?.sessionId && payload.profileId) {
        await removeActiveSession(payload.profileId, payload.sessionId);
      }
    }

    const response = successResponse({ message: "Logged out" });

    // Clear cookies
    const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
    const cookieOptions = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isHttps ? "; Secure" : ""}`;

    response.headers.set("Set-Cookie", [
      `access_token=; ${cookieOptions}`,
      `refresh_token=; ${cookieOptions}`,
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
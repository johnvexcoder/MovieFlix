import { NextRequest, NextResponse } from "next/server";
import { successResponse } from "@/lib/api-response";
import { verifyToken, verifyRefreshToken } from "@/lib/auth";
import { incrementTokenVersion } from "@/lib/redis";

export async function POST(request: NextRequest) {
  try {
    // Optionally revoke the refresh token by incrementing the version in Redis
    const refreshToken = request.cookies.get("refresh_token")?.value;
    if (refreshToken) {
      const payload = await verifyRefreshToken(refreshToken);
      if (payload) {
        await incrementTokenVersion(payload.profileId);
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

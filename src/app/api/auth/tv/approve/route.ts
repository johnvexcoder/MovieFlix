import { NextRequest } from "next/server";
import { successResponse, errorResponse, ERROR_CODES } from "@/lib/api-response";
import { getClientIp, verifyToken } from "@/lib/auth";
import { approveTvQrChallenge, TV_CODE_RE } from "@/lib/tv-auth";
import { setRateLimit } from "@/lib/redis";

export const dynamic = "force-dynamic";

/**
 * Approve a TV login from the phone. Re-verifies the caller's own session
 * token directly (this route is public at the proxy because the TV flow starts
 * unauthenticated), then stamps the challenge with the account id.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = await setRateLimit(`ratelimit:tv-approve:${getClientIp(request)}`, 5 * 60_000, 20);
    if (!limit.allowed) return errorResponse("Too many approval attempts. Please wait and try again.", 429);
    const body = await request.json().catch(() => ({}));
    const code = String(body.code || "").toUpperCase();
    if (!TV_CODE_RE.test(code)) {
      return errorResponse("Invalid TV login code", 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const accessToken = request.cookies.get("access_token")?.value;
    if (!accessToken) {
      return errorResponse("Authentication required", 401, ERROR_CODES.FORBIDDEN);
    }

    const payload = await verifyToken(accessToken);
    if (!payload || !payload.accountId) {
      return errorResponse("Authentication required", 401, ERROR_CODES.FORBIDDEN);
    }

    const approved = await approveTvQrChallenge(code, payload.accountId);
    if (!approved) {
      return errorResponse(
        "This TV login code is no longer valid. Go back to your TV and request a new one.",
        400,
        ERROR_CODES.NOT_FOUND
      );
    }

    return successResponse({ approved: true });
  } catch (error) {
    console.error("TV QR approve error:", error);
    return errorResponse("Could not approve TV login", 500);
  }
}

import { NextRequest } from "next/server";
import { successResponse, errorResponse, ERROR_CODES } from "@/lib/api-response";
import { getTvQrChallenge, TV_CODE_RE } from "@/lib/tv-auth";
import { getClientIp } from "@/lib/auth";
import { setRateLimit } from "@/lib/redis";

export const dynamic = "force-dynamic";

/** Status polled by the TV every few seconds while waiting for approval. */
export async function GET(request: NextRequest) {
  try {
    const limit = await setRateLimit(`ratelimit:tv-status:${getClientIp(request)}`, 60_000, 40);
    if (!limit.allowed) return errorResponse("Too many status requests", 429, ERROR_CODES.RATE_LIMITED);
    const code = String(request.nextUrl.searchParams.get("code") || "").toUpperCase();
    if (!TV_CODE_RE.test(code)) {
      return errorResponse("Invalid TV login code", 400, ERROR_CODES.VALIDATION_ERROR);
    }

    const challenge = await getTvQrChallenge(code);
    if (!challenge) {
      return errorResponse("TV login code not found or expired", 404, ERROR_CODES.NOT_FOUND);
    }

    return successResponse({
      status: challenge.status,
      ...(challenge.status === "approved" ? { claimToken: challenge.claimToken } : {}),
    });
  } catch (error) {
    console.error("TV QR status error:", error);
    return errorResponse("Could not check TV login code", 500);
  }
}

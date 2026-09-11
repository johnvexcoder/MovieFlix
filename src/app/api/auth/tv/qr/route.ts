import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-response";
import { createTvQrChallenge } from "@/lib/tv-auth";
import { getAppPublicUrl } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

/**
 * Create a TV login challenge. The approval URL is built server-side from the
 * canonical public URL (admin-configured) so a malicious TV can never phish a
 * user with a QR pointing at an attacker-controlled origin.
 */
export async function POST(_request: NextRequest) {
  try {
    const challenge = await createTvQrChallenge();
    const publicUrl = await getAppPublicUrl();
    const approveUrl = `${publicUrl}/login/approve?tv_code=${encodeURIComponent(challenge.code)}`;

    return successResponse({
      code: challenge.code,
      qrUrl: approveUrl,
      expiresIn: 600,
    });
  } catch (error) {
    console.error("TV QR create error:", error);
    return errorResponse("Could not create a TV login code", 500);
  }
}
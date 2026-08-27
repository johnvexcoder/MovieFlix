import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { startScan, getScanStatus } from "@/services/scanner";

export async function POST(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const currentScan = getScanStatus();
    if (currentScan?.status === "running") {
      return errorResponse("Scan already in progress", 409);
    }

    const scanId = await startScan("manual");

    return successResponse({
      scanId,
      message: "Scan started",
    });
  } catch (error) {
    console.error("Start scan error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const scan = getScanStatus();

    return successResponse({
      scan,
    });
  } catch (error) {
    console.error("Get scan status error:", error);
    return errorResponse("Internal server error", 500);
  }
}

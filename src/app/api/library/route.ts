import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { libraryConfig, scanLog } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { startScan, getScanStatus, getScanHistory } from "@/services/scanner";
import { v4 as uuidv4 } from "uuid";

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

    const libraries = await db.select().from(libraryConfig);
    const scan = getScanStatus();

    return successResponse({
      libraries,
      currentScan: scan,
    });
  } catch (error) {
    console.error("Get library error:", error);
    return errorResponse("Internal server error", 500);
  }
}

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

    const body = await request.json();
    const { path, type } = body;

    if (!path || !type) {
      return errorResponse("Path and type are required", 400);
    }

    if (type !== "movies" && type !== "series") {
      return errorResponse("Type must be 'movies' or 'series'", 400);
    }

    // Check if path already exists
    const [existing] = await db
      .select()
      .from(libraryConfig)
      .where(eq(libraryConfig.path, path))
      .limit(1);

    if (existing) {
      return errorResponse("Path already exists", 400);
    }

    await db.insert(libraryConfig).values({
      id: uuidv4(),
      path,
      type,
      enabled: true,
    });

    return successResponse({ message: "Library path added" }, 201);
  } catch (error) {
    console.error("Add library error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const body = await request.json();
    const { id, enabled } = body;

    if (!id) {
      return errorResponse("Library ID is required", 400);
    }

    await db
      .update(libraryConfig)
      .set({ enabled })
      .where(eq(libraryConfig.id, id));

    return successResponse({ message: "Library updated" });
  } catch (error) {
    console.error("Update library error:", error);
    return errorResponse("Internal server error", 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminToken = request.cookies.get("admin_token")?.value;
    if (!adminToken) {
      return errorResponse("Unauthorized", 401);
    }

    const payload = await verifyToken(adminToken);
    if (!payload?.isAdmin) {
      return errorResponse("Admin access required", 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return errorResponse("Library ID is required", 400);
    }

    await db.delete(libraryConfig).where(eq(libraryConfig.id, id));

    return successResponse({ message: "Library deleted" });
  } catch (error) {
    console.error("Delete library error:", error);
    return errorResponse("Internal server error", 500);
  }
}

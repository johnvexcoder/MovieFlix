import { NextRequest } from "next/server";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

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

    const settings = await db.select().from(appSettings);
    const config: Record<string, string> = {};
    settings.forEach((s) => {
      config[s.key] = s.value || "";
    });

    return successResponse({ settings: config });
  } catch (error) {
    console.error("Get settings error:", error);
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
    const { settings } = body;

    if (settings && typeof settings === "object") {
      // Upsert each setting
      for (const [key, value] of Object.entries(settings)) {
        if (typeof value === "string") {
          const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
          if (existing) {
            await db.update(appSettings).set({ value }).where(eq(appSettings.key, key));
          } else {
            await db.insert(appSettings).values({ key, value });
          }
        }
      }
    }

    return successResponse({ message: "Settings saved successfully" });
  } catch (error) {
    console.error("Update settings error:", error);
    return errorResponse("Internal server error", 500);
  }
}

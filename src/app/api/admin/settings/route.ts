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

    // Never return the SMTP password to the client. Indicate whether one is set
    // so the UI can prompt accordingly without leaking the secret.
    const smtpPassSet = Boolean(config["smtp_pass"]);
    delete config["smtp_pass"];
    config["smtp_pass_set"] = smtpPassSet ? "true" : "false";

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
      // Upsert each setting. The SMTP password is redacted on GET, so if the
      // admin saves without entering a new password (empty string) we preserve
      // the previously stored value rather than wiping it.
      for (const [key, value] of Object.entries(settings)) {
        if (typeof value !== "string") continue;
        if (key === "smtp_pass" && value.trim() === "") continue;
        const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
        if (existing) {
          await db.update(appSettings).set({ value }).where(eq(appSettings.key, key));
        } else {
          await db.insert(appSettings).values({ key, value });
        }
      }
    }

    return successResponse({ message: "Settings saved successfully" });
  } catch (error) {
    console.error("Update settings error:", error);
    return errorResponse("Internal server error", 500);
  }
}

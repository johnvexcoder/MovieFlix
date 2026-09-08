import { NextRequest } from "next/server";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

const ALLOWED_SETTINGS = new Set(["smtp_host","smtp_port","smtp_user","smtp_pass","smtp_from","reminder_days","reminder_message","max_sessions","session_timeout","app_public_url","about_team"]);

function sanitizeTeam(value: string): string | null {
  try {
    const data = JSON.parse(value);
    if (!Array.isArray(data) || data.length > 12) return null;
    return JSON.stringify(data.map((item) => ({
      id: String(item.id || "").slice(0, 80), name: String(item.name || "").trim().slice(0, 80),
      role: String(item.role || "").trim().slice(0, 80),
      imageUrl: String(item.imageUrl || "").startsWith("/api/files?file=") ? String(item.imageUrl) : "",
      positionX: Math.max(0, Math.min(100, Number(item.positionX) || 50)),
      positionY: Math.max(0, Math.min(100, Number(item.positionY) || 50)),
      scale: Math.max(100, Math.min(180, Number(item.scale) || 100)),
    })).filter((item) => item.id && item.name && item.role && item.imageUrl));
  } catch { return null; }
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
      const publicUrl = settings.app_public_url;
      if (typeof publicUrl === "string" && publicUrl.trim()) {
        try {
          const parsed = new URL(publicUrl.trim());
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return errorResponse("Public URL must use http:// or https://", 400);
          }
        } catch {
          return errorResponse("Public URL is not valid", 400);
        }
      }

      // Upsert each setting. The SMTP password is redacted on GET, so if the
      // admin saves without entering a new password (empty string) we preserve
      // the previously stored value rather than wiping it.
      db.transaction((tx) => {
        for (const [key, value] of Object.entries(settings)) {
          if (!ALLOWED_SETTINGS.has(key) || typeof value !== "string" || value.length > 50_000) continue;
          if (key === "smtp_pass" && value.trim() === "") continue;
          const safeValue = key === "about_team" ? sanitizeTeam(value) : value;
          if (safeValue === null) continue;
          tx.insert(appSettings)
            .values({ key, value: key === "app_public_url" ? safeValue.trim().replace(/\/+$/, "") : safeValue })
            .onConflictDoUpdate({
              target: appSettings.key,
              set: { value: key === "app_public_url" ? safeValue.trim().replace(/\/+$/, "") : safeValue },
            })
            .run();
        }
      });
    }

    return successResponse({ message: "Settings saved successfully" });
  } catch (error) {
    console.error("Update settings error:", error);
    return errorResponse("Internal server error", 500);
  }
}

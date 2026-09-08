import { NextRequest } from "next/server";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyToken } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("access_token")?.value;
  if (!token || !(await verifyToken(token))) return errorResponse("Unauthorized", 401);
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, "about_team")).limit(1);
  try {
    const team = row?.value ? JSON.parse(row.value) : [];
    return successResponse({ team: Array.isArray(team) ? team : [] });
  } catch {
    return successResponse({ team: [] });
  }
}

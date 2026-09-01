import { NextResponse } from "next/server";
import { setupDatabase } from "@/db/index";
import { startAccountCleanupService } from "@/services/account-cleanup";
import { ensureScanScheduler } from "@/services/scan-scheduler";

let initialized = false;

export async function GET() {
  if (!initialized) {
    try {
      setupDatabase();
      startAccountCleanupService();
      ensureScanScheduler();
      initialized = true;
    } catch (e) {
      console.error("Health check init error:", e);
    }
  }

  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
  });
}

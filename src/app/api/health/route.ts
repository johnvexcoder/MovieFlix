import { NextResponse } from "next/server";
import { getDb, setupDatabase } from "@/db/index";
import { sql } from "drizzle-orm";
import packageJson from "../../../../package.json";
import { startAccountCleanupService } from "@/services/account-cleanup";
import { ensureScanScheduler } from "@/services/scan-scheduler";

let initialized = false;

export async function GET() {
  try {
    if (!initialized) {
      setupDatabase();
      startAccountCleanupService();
      ensureScanScheduler();
      initialized = true;
    }
    getDb().run(sql`select 1`);

    return NextResponse.json({ status: "healthy", timestamp: new Date().toISOString(), version: packageJson.version });
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      { status: "unhealthy", timestamp: new Date().toISOString(), version: packageJson.version },
      { status: 503 }
    );
  }
}

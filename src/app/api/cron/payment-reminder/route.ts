import { NextRequest, NextResponse } from "next/server";
import { runSubscriptionReminders } from "@/lib/reminder-emails";

// Optional HTTP entry point for external schedulers. The same work also runs
// automatically twice a day via the built-in scheduler in instrumentation.ts.
// Protect with x-cron-secret to prevent public abuse.
export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await runSubscriptionReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("payment-reminder cron error:", error);
    return new NextResponse("Reminder cron failed", { status: 500 });
  }
}
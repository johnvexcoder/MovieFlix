export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupDatabase } = await import("@/db");
    try {
      setupDatabase();
      console.log("✅ Database initialized (tables + default admin ensured)");
    } catch (e) {
      console.error("Database init error:", e);
    }

    // Analytics aggregation runs inside the app (no external cron needed):
    // first deploy-time backfill + periodic refresh of recent days.
    try {
      const { ensureRecentAnalytics } = await import("@/lib/analytics-aggregate");
      void ensureRecentAnalytics(370)
        .then((r) =>
          console.log(`analytics.aggregation_initial aggregated=${r.aggregatedDays}${r.from !== r.to ? ` range=${r.from}..${r.to}` : ""}`)
        )
        .catch((e) => console.error("analytics.aggregation_initial_error", e));

      const timer = setInterval(() => {
        void ensureRecentAnalytics(4)
          .then((r) => console.log(`analytics.aggregation_refresh aggregated=${r.aggregatedDays}`))
          .catch((e) => console.error("analytics.aggregation_refresh_error", e));
      }, 60 * 60 * 1000);
      timer.unref?.();
    } catch (e) {
      console.error("analytics aggregation setup error:", e);
    }

    // Subscription reminder + expired-account emails, twice a day (every 12h),
    // plus one run shortly after startup. Idempotent per account.
    try {
      const { runSubscriptionReminders } = await import("@/lib/reminder-emails");
      const run = async (label: string) => {
        try {
          const r = await runSubscriptionReminders();
          console.log(`reminder_emails.${label} reminded=${r.reminded} expired=${r.expired}`);
        } catch (e) {
          console.error(`reminder_emails.${label}_error`, e);
        }
      };
      const initial = setTimeout(() => void run("initial"), 30 * 1000);
      initial.unref?.();
      const reminderTimer = setInterval(() => void run("twice_daily"), 12 * 60 * 60 * 1000);
      reminderTimer.unref?.();
    } catch (e) {
      console.error("reminder emails scheduler setup error:", e);
    }
  }
}
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
  }
}
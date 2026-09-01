import { startScan } from "./scanner";

let initialized = false;

function enabled(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return value.toLowerCase() !== "false" && value.toLowerCase() !== "0";
}

/**
 * Starts the auto media scanner: an initial scan shortly after boot plus a
 * background rescan every SCAN_INTERVAL_MINUTES. Honors SCAN_ON_STARTUP and
 * SCAN_INTERVAL_MINUTES from the environment (defaults: on, every 10 min).
 *
 * Called from the /api/health route so it only ever runs in the live server
 * process (never during `next build`), same as the DB init + cleanup service.
 */
export function ensureScanScheduler() {
  if (initialized) return;
  initialized = true;

  const onStartup = enabled(process.env.SCAN_ON_STARTUP, true);
  const intervalMinutes = Math.max(
    1,
    parseInt(process.env.SCAN_INTERVAL_MINUTES || "10", 10) || 10
  );

  const run = async () => {
    try {
      await startScan("auto");
    } catch (e) {
      // "Scan already in progress" (or DB not ready) — skip and retry later.
      console.log("[scan-scheduler]", e instanceof Error ? e.message : e);
    }
  };

  if (onStartup) {
    // Small delay so the server finishes booting before the first scan.
    setTimeout(() => {
      void run();
    }, 5000);
  }

  setInterval(() => {
    void run();
  }, intervalMinutes * 60 * 1000);
}
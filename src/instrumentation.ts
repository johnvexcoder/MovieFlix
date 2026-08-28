export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    // Defer the initialization to prevent better-sqlite3 native bindings
    // from causing a Segmentation Fault during Next.js worker thread startup.
    setTimeout(async () => {
      try {
        const { startAccountCleanupService } = await import("./services/account-cleanup");
        const { setupDatabase } = await import("./db/index");
        
        setupDatabase();
        startAccountCleanupService();
      } catch (error) {
        console.error("Failed to initialize database or background services:", error);
      }
    }, 1000);
  }
}

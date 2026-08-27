export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAccountCleanupService } = await import("./services/account-cleanup");
    startAccountCleanupService();
  }
}
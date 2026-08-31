export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { setupDatabase } = await import("@/db");
    try {
      setupDatabase();
      console.log("✅ Database initialized (tables + default admin ensured)");
    } catch (e) {
      console.error("Database init error:", e);
    }
  }
}

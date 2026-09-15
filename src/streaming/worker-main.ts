import { prepareNextJob, recoverStaleJobs } from "./worker";

const controller = new AbortController();
process.on("SIGTERM", () => controller.abort());
process.on("SIGINT", () => controller.abort());

async function main() {
  if (process.env.STREAMING_WORKER_ENABLED !== "true") {
    throw new Error("Streaming worker is disabled");
  }
  while (!controller.signal.aborted) {
    await recoverStaleJobs();
    const worked = await prepareNextJob(controller.signal);
    if (!worked) await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

void main().catch((error) => {
  console.error("Streaming worker stopped:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
});

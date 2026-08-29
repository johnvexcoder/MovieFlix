import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getEnv } from "@/lib/env";
import { isSafeFfmpegInput } from "@/lib/ffmpeg-security";

// Quality ladder (heights), ordered high -> low
export const QUALITY_LADDER = [2160, 1440, 1080, 720, 480, 360];

const MAX_STARTUP_WAIT_MS = 240_000;

interface ActiveJob {
  height: number;
  proc: ffmpeg.FfmpegCommand;
  startedAt: number;
}

// Simple in-process concurrency gate
const activeJobs = new Map<string, ActiveJob>();
const pendingQueue: (() => void)[] = [];
let runningJobs = 0;

function getEnvView() {
  return getEnv();
}

function resolveTempRoot(): string {
  const { TRANSCODE_TEMP_DIR } = getEnvView();
  return path.isAbsolute(TRANSCODE_TEMP_DIR)
    ? TRANSCODE_TEMP_DIR
    : path.resolve(process.cwd(), TRANSCODE_TEMP_DIR);
}

/** Stable cache key for a given source file */
export function transcodeKey(filePath: string): string {
  return crypto.createHash("sha1").update(filePath).digest("hex").slice(0, 24);
}

export function renditionFile(key: string, height: number): string {
  return path.join(resolveTempRoot(), key, String(height), "video.mp4");
}

export function renditionDir(key: string, height: number): string {
  return path.join(resolveTempRoot(), key, String(height));
}

/** Return heights we should expose, capped by the source's native height. */
export function availableHeights(sourceHeight: number | null): number[] {
  const src = sourceHeight || 4320;
  return QUALITY_LADDER.filter((h) => h <= src);
}

export function isRenditionReady(key: string, height: number): boolean {
  const file = renditionFile(key, height);
  if (!fs.existsSync(file)) return false;
  // A fragmented MP4 is "ready to play" once the moov data (+ some fragments) exist.
  const size = fs.statSync(file).size;
  return size > 64 * 1024;
}

function startSingleJob(key: string, height: number, sourceFile: string): Promise<void> {
  const slots = getEnvView().TRANSCODE_MAX_CONCURRENT || 2;

  return new Promise<void>((resolve, reject) => {
    const begin = () => {
      runningJobs++;
      const dir = renditionDir(key, height);
      fs.mkdirSync(dir, { recursive: true });
      const outFile = renditionFile(key, height);
      // Remove any stale partial output
      if (fs.existsSync(outFile)) fs.rmSync(outFile, { force: true });

      const proc = ffmpeg(sourceFile, { timeout: 0 })
        .outputOptions([
          "-map 0:v:0",
          "-map 0:a:0?",
          "-c:v libx264",
          "-preset veryfast",
          "-crf 23",
          "-pix_fmt yuv420p",
          "-vf",
          `scale=-2:${height}`,
          "-c:a aac",
          "-b:a 128k",
          "-ac 2",
          "-movflags",
          "frag_keyframe+empty_moov+faststart",
          "-f",
          "mp4",
        ])
        .output(outFile);

      activeJobs.set(`${key}:${height}`, { height, proc, startedAt: Date.now() });

      let settled = false;
      const onEnd = () => {
        if (settled) return;
        settled = true;
        activeJobs.delete(`${key}:${height}`);
        runningJobs--;
        dequeue();
        resolve();
      };
      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        activeJobs.delete(`${key}:${height}`);
        runningJobs--;
        dequeue();
        reject(err);
      };

      proc.on("end", onEnd).on("error", onError).run();
    };

    const tryRun = () => {
      if (runningJobs < slots) {
        begin();
      } else {
        pendingQueue.push(() => begin());
      }
    };
    tryRun();
  });
}

/**
 * Ensure a rendition is being (or has been) transcoded. Returns as soon as the
 * file is playable (moov + initial fragments present). If a full transcode has
 * already been done, returns immediately.
 */
export async function ensureTranscode(
  filePath: string,
  height: number
): Promise<{ status: "ready" | "running" | "failed" }> {
  if (!isSafeFfmpegInput(filePath)) {
    console.error(`Refusing to transcode unsafe input path: ${filePath}`);
    return { status: "failed" };
  }
  const key = transcodeKey(filePath);
  if (isRenditionReady(key, height)) {
    return { status: "ready" };
  }

  const jobKey = `${key}:${height}`;
  if (activeJobs.has(jobKey)) {
    return { status: "running" };
  }

  const started = Date.now();
  startSingleJob(key, height, filePath).catch(() => {});

  // Poll for playability up to a timeout; job continues in background after.
  while (Date.now() - started < MAX_STARTUP_WAIT_MS) {
    if (isRenditionReady(key, height)) {
      return { status: "ready" };
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  return isRenditionReady(key, height) ? { status: "ready" } : { status: "running" };
}

export function cancelTranscodes(key: string): void {
  for (const [jobKey, job] of activeJobs) {
    if (jobKey.startsWith(key)) {
      try {
        job.proc.kill("SIGKILL");
      } catch {}
      activeJobs.delete(jobKey);
    }
  }
}

function dequeue(): void {
  if (pendingQueue.length > 0) {
    const next = pendingQueue.shift();
    if (next) next();
  }
}

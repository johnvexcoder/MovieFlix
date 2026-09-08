import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getEnv } from "@/lib/env";
import { isSafeFfmpegInput } from "@/lib/ffmpeg-security";

const ffmpegExecutable = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
ffmpeg.setFfmpegPath(ffmpegExecutable);

// Quality ladder (heights), ordered high -> low
export const QUALITY_LADDER = [2160, 1440, 1080, 720, 480, 360];

// Route callers poll readiness. Keep each request short so reverse proxies,
// browsers, and Smart TVs do not time out while a full movie is transcoding.
const MAX_STARTUP_WAIT_MS = 750;

interface ActiveJob {
  height: number;
  proc: ffmpeg.FfmpegCommand;
  startedAt: number;
}

// Simple in-process concurrency gate
const activeJobs = new Map<string, ActiveJob>();
const pendingQueue: (() => void)[] = [];
let runningJobs = 0;
const recentFailures = new Map<string, number>();
const FAILURE_COOLDOWN_MS = 30_000;

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
  return path.join(resolveTempRoot(), key, String(height), "index.m3u8");
}

export function renditionDir(key: string, height: number): string {
  return path.join(resolveTempRoot(), key, String(height));
}

function completionFile(key: string, height: number): string {
  return path.join(renditionDir(key, height), ".complete");
}

/** Return heights we should expose, capped by the source's native height. */
export function availableHeights(sourceHeight: number | null): number[] {
  const src = sourceHeight || 4320;
  return QUALITY_LADDER.filter((h) => h <= src);
}

export function isRenditionReady(key: string, height: number): boolean {
  const file = renditionFile(key, height);
  if (!fs.existsSync(file)) return false;
  try {
    // HLS is safe to expose while it grows: its duration is described by
    // completed media segments rather than a temporary MP4 Content-Length.
    const manifest = fs.readFileSync(file, "utf8");
    const firstSegment = manifest.match(/^([^#\r\n]+\.ts)$/m)?.[1];
    return Boolean(firstSegment && fs.existsSync(path.join(renditionDir(key, height), firstSegment)));
  } catch {
    return false;
  }
}

function startSingleJob(key: string, height: number, sourceFile: string): Promise<void> {
  const slots = getEnvView().TRANSCODE_MAX_CONCURRENT || 2;

  return new Promise<void>((resolve, reject) => {
    const begin = () => {
      runningJobs++;
      const dir = renditionDir(key, height);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const outFile = renditionFile(key, height);
      // Remove any stale partial output
      fs.rmSync(completionFile(key, height), { force: true });

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
          // Light volume gain on the transcoded rendition only (source file is
          // never modified). Purely a perceptual boost for quiet sources —
          // no dynamics processing, no loudness normalization.
          "-af",
          "volume=6dB",
          "-f", "hls",
          "-hls_time", "4",
          "-hls_list_size", "0",
          "-hls_playlist_type", "event",
          "-hls_flags", "independent_segments+temp_file",
          "-force_key_frames", "expr:gte(t,n_forced*4)",
          "-hls_segment_filename", path.join(dir, "segment-%05d.ts"),
        ])
        .output(outFile);

      activeJobs.set(`${key}:${height}`, { height, proc, startedAt: Date.now() });

      let settled = false;
      const onEnd = () => {
        if (settled) return;
        settled = true;
        activeJobs.delete(`${key}:${height}`);
        recentFailures.delete(`${key}:${height}`);
        fs.writeFileSync(completionFile(key, height), new Date().toISOString());
        runningJobs--;
        dequeue();
        resolve();
      };
      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        activeJobs.delete(`${key}:${height}`);
        recentFailures.set(`${key}:${height}`, Date.now());
        console.error(`Compatibility transcode failed (${height}p):`, err);
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

  const failedAt = recentFailures.get(jobKey);
  if (failedAt && Date.now() - failedAt < FAILURE_COOLDOWN_MS) {
    return { status: "failed" };
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

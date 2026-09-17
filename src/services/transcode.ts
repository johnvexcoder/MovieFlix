import ffmpeg from "fluent-ffmpeg";
import { configureFfmpeg } from "@/lib/ffmpeg-runtime";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getEnv } from "@/lib/env";
import { isSafeFfmpegInput } from "@/lib/ffmpeg-security";
import { probeFile } from "@/services/ffmpeg-probe";

configureFfmpeg();

// Quality ladder (heights), ordered high -> low
export const QUALITY_LADDER = [2160, 1440, 1080, 720, 480, 360];

// Route callers poll readiness. Keep each request short so reverse proxies,
// browsers, and Smart TVs do not time out while a full movie is transcoding.
const MAX_STARTUP_WAIT_MS = 750;

interface ActiveJob {
  height: number;
  proc: ffmpeg.FfmpegCommand;
  startedAt: number;
  lastRequestedAt: number;
}

// Simple in-process concurrency gate
const activeJobs = new Map<string, ActiveJob>();
const queuedJobs = new Map<string, number>();
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
  const dir = renditionDir(key, height);
  const file = renditionFile(key, height);
  if (!fs.existsSync(file)) return false;
  // A generated rendition is only considered playable once the encoder has
  // finished the WHOLE movie and its output passed duration validation. A
  // growing EVENT playlist from an in-flight or killed encode is never
  // exposed; callers poll until completion and the player keeps waiting.
  if (!fs.existsSync(completionFile(key, height))) return false;
  try {
    const manifest = fs.readFileSync(file, "utf8");
    if (!manifest.includes("#EXT-X-ENDLIST")) return false;
    const firstSegment = manifest.match(/^([^#\r\n]+\.ts)$/m)?.[1];
    return Boolean(firstSegment && fs.existsSync(path.join(dir, firstSegment)));
  } catch {
    return false;
  }
}

/** Default tolerance used when validating a finished rendition's duration. */
export function durationToleranceSeconds(sourceDuration: number): number {
  return Math.max(5, sourceDuration * 0.01);
}

function appendEndlistIfMissing(key: string, height: number): void {
  const file = renditionFile(key, height);
  if (!fs.existsSync(file)) return;
  let manifest = fs.readFileSync(file, "utf8");
  if (!manifest.includes("#EXT-X-ENDLIST")) {
    manifest = manifest.replace(/\s*$/, "") + "\n#EXT-X-ENDLIST\n";
    fs.writeFileSync(file, manifest);
  }
}

/**
 * Validate that a finished HLS rendition covers essentially the whole source
 * movie. A rendition that stopped early (killed encode, truncated file) must
 * never become READY/SERVED.
 */
async function validateRenditionDuration(
  key: string,
  height: number,
  sourceDurationSeconds: number | undefined
): Promise<boolean> {
  const file = renditionFile(key, height);
  if (!sourceDurationSeconds || sourceDurationSeconds <= 0) {
    // No trusted source duration available: completeness (ENDLIST, exit 0) is
    // the strongest signal we can enforce.
    return true;
  }
  const probed = await probeFile(file);
  if (!probed || probed.duration <= 0) {
    console.error(`[MovieFlix Transcode] validation: ffprobe could not read ${file}`);
    return false;
  }
  const diff = Math.abs(probed.duration - sourceDurationSeconds);
  const tolerance = durationToleranceSeconds(sourceDurationSeconds);
  if (diff > tolerance) {
    console.error(
      `[MovieFlix Transcode] ${height}p INVALID duration: source=${sourceDurationSeconds}s output=${probed.duration}s (delta=${diff.toFixed(1)}s > tol=${tolerance.toFixed(1)}s)`
    );
    return false;
  }
  if (probed.height !== null && probed.height !== Math.round(height)) {
    console.error(
      `[MovieFlix Transcode] ${height}p INVALID height: expected ${height} got ${probed.height}`
    );
    return false;
  }
  return true;
}

function startSingleJob(
  key: string,
  height: number,
  sourceFile: string,
  options: { copyVideo?: boolean; copyAudio?: boolean; sourceDurationSeconds?: number } = {}
): Promise<void> {
  const slots = getEnvView().TRANSCODE_MAX_CONCURRENT || 2;

  return new Promise<void>((resolve, reject) => {
    const begin = () => {
      const jobKey = `${key}:${height}`;
      const lastQueuedRequest = queuedJobs.get(jobKey);
      queuedJobs.delete(jobKey);
      if (lastQueuedRequest && Date.now() - lastQueuedRequest > 45_000) {
        dequeue();
        resolve();
        return;
      }
      runningJobs++;
      const dir = renditionDir(key, height);
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const outFile = renditionFile(key, height);
      // Remove any stale partial output
      fs.rmSync(completionFile(key, height), { force: true });

      const videoOptions = options.copyVideo
        ? ["-c:v copy"]
        : ["-c:v libx264", "-preset ultrafast", "-tune zerolatency", "-crf 23", "-pix_fmt yuv420p", "-vf", `scale=-2:${height}`];
      const audioOptions = options.copyAudio
        ? ["-c:a copy"]
        : ["-c:a aac", "-b:a 128k", "-ac 2", "-af", "volume=6dB"];
      const proc = ffmpeg(sourceFile, { timeout: 0 })
        .outputOptions([
          "-map 0:v:0",
          "-map 0:a:0?",
          ...videoOptions,
          ...audioOptions,
          "-f", "hls",
          "-hls_time", "2",
          "-hls_list_size", "0",
          "-hls_playlist_type", "event",
          "-hls_flags", "independent_segments+temp_file",
          "-force_key_frames", "expr:gte(t,n_forced*2)",
          "-hls_segment_filename", path.join(dir, "segment-%05d.ts"),
        ])
        .output(outFile);

      activeJobs.set(`${key}:${height}`, { height, proc, startedAt: Date.now(), lastRequestedAt: Date.now() });
      console.log(
        `[MovieFlix Transcode] started key=${key} quality=${height}p copyVideo=${!!options.copyVideo} copyAudio=${!!options.copyAudio} sourceDuration=${options.sourceDurationSeconds ?? "unknown"}`
      );

      let settled = false;
      const onEnd = () => {
        if (settled) return;
        settled = true;
        activeJobs.delete(`${key}:${height}`);
        recentFailures.delete(`${key}:${height}`);
        // Finalize and validate BEFORE the rendition can be served. The
        // encoder finished the whole movie: pin the playlist with ENDLIST and
        // prove its duration matches the source, then write the readiness
        // marker. A rendition that fails validation is removed so the next
        // request regenerates it instead of serving a truncated movie.
        void (async () => {
          try {
            appendEndlistIfMissing(key, height);
            runningJobs--;
            dequeue();
            const valid = await validateRenditionDuration(key, height, options.sourceDurationSeconds);
            if (!valid) {
              recentFailures.set(`${key}:${height}`, Date.now());
              fs.rmSync(renditionDir(key, height), { recursive: true, force: true });
              console.error(
                `[MovieFlix Transcode] validation FAILED key=${key} quality=${height}p — discarded partial/invalid rendition`
              );
              reject(new Error(`${height}p rendition failed duration validation`));
              return;
            }
            fs.writeFileSync(completionFile(key, height), new Date().toISOString());
            console.log(
              `[MovieFlix Transcode] completed key=${key} quality=${height}p sourceDuration=${options.sourceDurationSeconds ?? "unknown"} validated=true`
            );
            resolve();
          } catch (error) {
            recentFailures.set(`${key}:${height}`, Date.now());
            reject(error instanceof Error ? error : new Error(`${height}p finalization failed`));
          }
        })();
      };
      const onError = (err: Error) => {
        if (settled) return;
        settled = true;
        activeJobs.delete(`${key}:${height}`);
        recentFailures.set(`${key}:${height}`, Date.now());
        console.error(`[MovieFlix Transcode] failed (${height}p):`, err);
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
        queuedJobs.set(`${key}:${height}`, Date.now());
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
  height: number,
  options: { copyVideo?: boolean; copyAudio?: boolean; sourceDurationSeconds?: number } = {}
): Promise<{ status: "ready" | "running" | "failed" }> {
  if (!isSafeFfmpegInput(filePath)) {
    console.error(`Refusing to transcode unsafe input path: ${filePath}`);
    return { status: "failed" };
  }
  const key = transcodeKey(filePath);
  touchTranscode(key, height);
  if (isRenditionReady(key, height)) {
    return { status: "ready" };
  }

  const jobKey = `${key}:${height}`;
  const active = activeJobs.get(jobKey);
  if (active) {
    active.lastRequestedAt = Date.now();
    return { status: "running" };
  }
  if (queuedJobs.has(jobKey)) {
    queuedJobs.set(jobKey, Date.now());
    return { status: "running" };
  }

  const failedAt = recentFailures.get(jobKey);
  if (failedAt && Date.now() - failedAt < FAILURE_COOLDOWN_MS) {
    return { status: "failed" };
  }

  recentFailures.delete(jobKey);
  const started = Date.now();
  startSingleJob(key, height, filePath, options).catch(() => {});

  // Poll for playability up to a timeout; job continues in background after.
  while (Date.now() - started < MAX_STARTUP_WAIT_MS) {
    if (isRenditionReady(key, height)) {
      return { status: "ready" };
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  if (recentFailures.has(jobKey)) return { status: "failed" };
  return isRenditionReady(key, height) ? { status: "ready" } : { status: "running" };
}

// Monitor for genuinely hung encodes. We must NEVER kill a slow-but-progressing
// full-movie transcode (that is exactly how truncated renditions were born).
// A healthy HLS encode writes a new ~2s segment continuously, so any active
// job that has produced no segment for a long window is stuck on a broken
// input/hung encoder and is safely reclaimed; the next viewer request will
// restart it from scratch, and the partial output is never served.
const STALL_WINDOW_MS = 150_000;
const stallTimer = setInterval(() => {
  const now = Date.now();
  for (const [jobKey, job] of activeJobs) {
    const separator = jobKey.lastIndexOf(":");
    if (separator <= 0) continue;
    const key = jobKey.slice(0, separator);
    const height = Number(jobKey.slice(separator + 1));
    const dir = renditionDir(key, height);
    let newestSegmentMs = 0;
    try {
      for (const entry of fs.readdirSync(dir)) {
        if (!/^segment-\d{5}\.ts$/.test(entry)) continue;
        const segment = fs.statSync(path.join(dir, entry));
        if (segment.mtimeMs > newestSegmentMs) newestSegmentMs = segment.mtimeMs;
      }
    } catch {
      continue;
    }
    if (now - newestSegmentMs > STALL_WINDOW_MS) {
      console.error(`[MovieFlix Transcode] stalled for ${(now - newestSegmentMs) / 1000}s, killing ${jobKey}`);
      try { job.proc.kill("SIGKILL"); } catch {}
      activeJobs.delete(jobKey);
    }
  }
}, 15_000);
stallTimer.unref?.();

export function touchTranscode(key: string, height: number): void {
  const job = activeJobs.get(`${key}:${height}`);
  if (job) job.lastRequestedAt = Date.now();
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

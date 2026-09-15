import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { planRenditions, type SourceVideo, type Rendition } from "./planner";

interface ProbeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
}

interface ProbeResult {
  streams?: ProbeStream[];
  format?: { duration?: string };
}

function run(program: string, args: string[], signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(program, args, { stdio: ["ignore", "pipe", "pipe"], signal });
    let output = "";
    let errors = "";
    proc.stdout.setEncoding("utf8").on("data", (chunk: string) => { output += chunk; });
    proc.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      if (errors.length < 4096) errors += chunk.slice(0, 4096 - errors.length);
    });
    proc.on("error", reject);
    proc.on("close", (code) => code === 0 ? resolve(output) : reject(new Error(`Media process failed (${code}): ${errors.slice(-400)}`)));
  });
}

export async function probeSource(filePath: string, signal?: AbortSignal): Promise<SourceVideo> {
  const raw = await run(process.env.FFPROBE_PATH || "ffprobe", [
    "-v", "error", "-show_streams", "-show_format", "-of", "json", filePath,
  ], signal);
  const data = JSON.parse(raw) as ProbeResult;
  const video = data.streams?.find((entry) => entry.codec_type === "video");
  const durationSeconds = Number(data.format?.duration || video?.duration || 0);
  if (!video?.width || !video.height || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("MEDIA_UNSUPPORTED");
  }
  return {
    width: video.width,
    height: video.height,
    durationSeconds,
    hasAudio: Boolean(data.streams?.some((entry) => entry.codec_type === "audio")),
  };
}

async function encodeRendition(
  sourceFile: string, outputDir: string, rendition: Rendition,
  hasAudio: boolean, segmentSeconds: number, signal?: AbortSignal,
): Promise<void> {
  fs.mkdirSync(outputDir, { recursive: true });
  const args = ["-hide_banner", "-loglevel", "error", "-nostdin", "-i", sourceFile,
    "-map", "0:v:0", ...(hasAudio ? ["-map", "0:a:0"] : []),
    "-vf", `scale=${rendition.width}:${rendition.height}:flags=lanczos,setsar=1`,
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-b:v", `${rendition.videoBitrateKbps}k`, "-maxrate", `${Math.round(rendition.videoBitrateKbps * 1.15)}k`,
    "-bufsize", `${rendition.videoBitrateKbps * 2}k`,
    "-force_key_frames", `expr:gte(t,n_forced*${segmentSeconds})`,
    ...(hasAudio ? ["-c:a", "aac", "-b:a", `${rendition.audioBitrateKbps}k`, "-ac", "2"] : ["-an"]),
    "-f", "hls", "-hls_time", String(segmentSeconds), "-hls_playlist_type", "vod",
    "-hls_segment_type", "fmp4", "-hls_fmp4_init_filename", "init.mp4",
    "-hls_flags", "independent_segments", "-hls_segment_filename", path.join(outputDir, "seg-%06d.m4s"),
    path.join(outputDir, "index.m3u8")];
  await run(process.env.FFMPEG_PATH || "ffmpeg", args, signal);
}

/** Encodes into a private temporary directory. The caller activates it only after validation. */
export async function encodePackage(
  sourceFile: string, tempDir: string, segmentSeconds: number,
  onProgress?: (completed: number, total: number) => void, signal?: AbortSignal,
): Promise<{ source: SourceVideo; renditions: Rendition[] }> {
  if (!Number.isInteger(segmentSeconds) || segmentSeconds < 2 || segmentSeconds > 10) {
    throw new Error("Invalid segment duration");
  }
  const source = await probeSource(sourceFile, signal);
  const renditions = planRenditions(source);
  fs.mkdirSync(tempDir, { recursive: true });
  for (let i = 0; i < renditions.length; i++) {
    const rendition = renditions[i];
    await encodeRendition(sourceFile, path.join(tempDir, `${rendition.height}p`),
      rendition, source.hasAudio, segmentSeconds, signal);
    onProgress?.(i + 1, renditions.length);
  }
  const lines = ["#EXTM3U", "#EXT-X-VERSION:7", "#EXT-X-INDEPENDENT-SEGMENTS"];
  for (const rendition of renditions) {
    const bandwidth = (rendition.videoBitrateKbps + rendition.audioBitrateKbps) * 1000;
    lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${rendition.width}x${rendition.height}`);
    lines.push(`${rendition.height}p/index.m3u8`);
  }
  fs.writeFileSync(path.join(tempDir, "master.m3u8"), `${lines.join("\n")}\n`, { flag: "wx" });
  return { source, renditions };
}

import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import path from "path";
import fs from "fs/promises";

let ffmpegConfigured = false;
function ensureFfmpeg() {
  if (!ffmpegConfigured) {
    if (ffmpegStatic) {
      try {
        ffmpeg.setFfmpegPath(ffmpegStatic);
      } catch {}
    }
    ffmpegConfigured = true;
  }
}

export interface ProbeResult {
  duration: number;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
  bitrate: number;
  container: string;
  size: number;
}

export async function probeFile(filePath: string): Promise<ProbeResult | null> {
  try {
    ensureFfmpeg();
    await fs.access(filePath);

    return new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          console.error(`FFprobe error for ${filePath}:`, err);
          resolve(null);
          return;
        }

        const videoStream = metadata.streams.find(
          (s) => s.codec_type === "video"
        );
        const audioStream = metadata.streams.find(
          (s) => s.codec_type === "audio"
        );

        resolve({
          duration: Math.round(metadata.format.duration || 0),
          videoCodec: videoStream?.codec_name || null,
          audioCodec: audioStream?.codec_name || null,
          width: videoStream?.width || null,
          height: videoStream?.height || null,
          bitrate: parseInt(String(metadata.format.bit_rate || "0")),
          container: metadata.format.format_name || "unknown",
          size: metadata.format.size || 0,
        });
      });
    });
  } catch (error) {
    console.error(`File access error for ${filePath}:`, error);
    return null;
  }
}

export function needsTranscode(probe: ProbeResult): boolean {
  const compatibleVideoCodecs = ["h264", "avc1"];
  const compatibleContainers = ["mp4", "matroska,webm"];

  const hasCompatibleVideo =
    probe.videoCodec && compatibleVideoCodecs.includes(probe.videoCodec);

  const hasCompatibleContainer =
    probe.container &&
    compatibleContainers.some((c) => probe.container.toLowerCase().includes(c));

  return !hasCompatibleVideo || !hasCompatibleContainer;
}

export async function generateThumbnail(
  filePath: string,
  outputPath: string,
  percentage: number = 25
): Promise<boolean> {
  try {
    ensureFfmpeg();
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });

    return new Promise((resolve) => {
      ffmpeg(filePath)
        .on("end", () => resolve(true))
        .on("error", (err) => {
          console.error(`Thumbnail generation error:`, err);
          resolve(false);
        })
        .screenshots({
          count: 1,
          folder: dir,
          filename: path.basename(outputPath),
          size: "400x225",
          timestamps: [`${percentage}%`],
        });
    });
  } catch (error) {
    console.error(`Thumbnail generation failed:`, error);
    return false;
  }
}

import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";

// fluent-ffmpeg shares executable configuration across probe and transcode
// callers. Always use the same resolution policy so probing cannot overwrite
// an explicitly configured system binary with a missing bundled binary.
export function configureFfmpeg(): void {
  let executable = process.env.FFMPEG_PATH;
  if (!executable && ffmpegStatic) {
    try {
      fs.accessSync(ffmpegStatic, fs.constants.X_OK);
      executable = ffmpegStatic;
    } catch {
      // Package installs with scripts disabled may not contain the binary.
    }
  }
  ffmpeg.setFfmpegPath(executable || "ffmpeg");
  if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

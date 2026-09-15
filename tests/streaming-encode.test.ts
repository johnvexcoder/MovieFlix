import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { encodePackage } from "../src/streaming/encoder";
import { validatePackage } from "../src/streaming/validator";

async function main() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movieflix-hls-test-"));
  try {
    const source = path.join(dir, "source.mp4");
    const fixture = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi",
      "-i", "testsrc2=size=640x360:rate=24", "-f", "lavfi", "-i", "sine=frequency=500:sample_rate=48000",
      "-t", "8", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", source],
      { encoding: "utf8" });
    assert.equal(fixture.status, 0, fixture.stderr);
    const output = path.join(dir, "package");
    const result = await encodePackage(source, output, 4);
    assert.deepEqual(result.renditions.map((entry) => entry.height), [240, 360]);
    const size = validatePackage(output, result.renditions, result.source.durationSeconds);
    assert(size > 0);
    assert(fs.existsSync(path.join(output, "240p", "init.mp4")));
    assert(fs.readdirSync(path.join(output, "360p")).some((name) => name.endsWith(".m4s")));
    console.log("Streaming fMP4 package encode and validation passed");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });

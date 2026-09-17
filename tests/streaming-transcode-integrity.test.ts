import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "movieflix-transcode-integrity-"));
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_PATH: path.join(temp, "db.sqlite"),
  STREAMING_OUTPUT_DIR: path.join(temp, "streaming"),
  STREAMING_V2_ENABLED: "false",
  TRANSCODE_TEMP_DIR: path.join(temp, "transcode-temp"),
  TRANSCODE_MAX_CONCURRENT: "1",
  JWT_SECRET: "test-transcode-secret-that-is-long-and-unique-1",
  JWT_REFRESH_SECRET: "test-transcode-refresh-secret-that-is-long-2",
  FFMPEG_PATH: process.env.FFMPEG_PATH || "ffmpeg",
  FFPROBE_PATH: process.env.FFPROBE_PATH || "ffprobe",
});

const SOURCE_SECONDS = 300;

function run(cmd: string, args: string[]): void {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  assert.equal(res.status, 0, `${cmd} ${args.join(" ")} failed:\n${res.stderr}`);
}

async function main() {
  try {
    // Build a ~5 minute 1280x720 H.264/AAC source. It is deliberately longer
    // than any idle timeout so a healthy encode MUST be allowed to run to
    // completion without any segment pulls, and any rendition that stops
    // early is provably truncated.
    const src = path.join(temp, "source.mp4");
    run("ffmpeg", [
      "-y", "-f", "lavfi", "-i", "testsrc2=duration=300:size=1280x720:rate=25",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=300",
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart",
      src,
    ]);
    assert.ok(fs.existsSync(src));

    const { probeFile } = await import("../src/services/ffmpeg-probe");
    const { transcodeKey, isRenditionReady, ensureTranscode, renditionFile, renditionDir } =
      await import("../src/services/transcode");

    const probe = await probeFile(src);
    assert.ok(probe, "source probe must succeed");
    const sourceDuration = probe.duration;
    assert.ok(
      Math.abs(sourceDuration - SOURCE_SECONDS) <= 5,
      `source should be ~${SOURCE_SECONDS}s, probed ${sourceDuration}s`
    );
    const key = transcodeKey(src);

    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    // ---- Case A: a long recode (480p) completes in the background with NO
    // segment pulls and is NEVER served before it is complete + validated.
    assert.equal(isRenditionReady(key, 480), false, "480p must not be ready before any work");
    const runPromise = ensureTranscode(src, 480, { sourceDurationSeconds: sourceDuration });
    // Immediately after dispatch the rendition must still not be exposed.
    assert.equal(isRenditionReady(key, 480), false, "in-flight rendition must never be readable");
    const { status } = await runPromise;
    assert.ok(["ready", "running"].includes(status), `unexpected ensureTranscode status: ${status}`);
    // Poll — while it runs, readiness must stay false; it flips to true only
    // once ffmpeg finished the WHOLE input and validation passed.
    const deadline = Date.now() + 300_000;
    let ready480 = false;
    while (Date.now() < deadline) {
      if (isRenditionReady(key, 480)) { ready480 = true; break; }
      await wait(1000);
    }
    assert.ok(ready480, "480p should eventually become ready after full encode + validation");

    const m3u8 = fs.readFileSync(renditionFile(key, 480), "utf8");
    assert.ok(m3u8.includes("#EXT-X-ENDLIST"), "completed playlist must be pinned with ENDLIST");
    assert.ok(fs.existsSync(path.join(renditionDir(key, 480), ".complete")), ".complete marker must exist");
    const renditionProbe = await probeFile(renditionFile(key, 480));
    assert.ok(renditionProbe, "ffprobe must read the finished rendition playlist");
    assert.ok(
      Math.abs(renditionProbe.duration - sourceDuration) <= Math.max(5, sourceDuration * 0.01),
      `480p must match source duration (src=${sourceDuration}s out=${renditionProbe.duration}s)`
    );

    // ---- Case B: a stale/truncated rendition (old-style partial dir, no
    // ENDLIST, no .complete) must NEVER be served and must be regenerated.
    const staleDir = renditionDir(key, 360);
    fs.mkdirSync(staleDir, { recursive: true });
    fs.writeFileSync(path.join(staleDir, "index.m3u8"),
      "#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:2\n#EXT-X-PLAYLIST-TYPE:EVENT\n#EXTINF:2.000000,\nsegment-00000.ts\n#EXTINF:2.000000,\nsegment-00001.ts\n");
    fs.writeFileSync(path.join(staleDir, "segment-00000.ts"), Buffer.alloc(64));
    fs.writeFileSync(path.join(staleDir, "segment-00001.ts"), Buffer.alloc(64));
    assert.equal(isRenditionReady(key, 360), false, "truncated EVT playlist without ENDLIST/.complete must not be ready");
    await ensureTranscode(src, 360, { sourceDurationSeconds: sourceDuration });
    const staleDeadline = Date.now() + 300_000;
    while (Date.now() < staleDeadline) {
      if (isRenditionReady(key, 360)) break;
      await wait(1000);
    }
    assert.ok(isRenditionReady(key, 360), "the stale partial rendition must be regenerated, not served");
    const regenerated = fs.readFileSync(renditionFile(key, 360), "utf8");
    assert.ok(regenerated.includes("#EXT-X-ENDLIST"), "regenerated 360p playlist must be complete");
    assert.ok(regenerated.length > 1000 && regenerated.includes("segment-00020.ts"),
      "regenerated 360p must be the full encode, not the 2-segment truncated prefab");

    // ---- Case C: duration validation must reject an output that does not
    // match the source timeline (simulating a truncated/partial rendition).
    const rejection = ensureTranscode(src, 720, { sourceDurationSeconds: 7088 });
    const settleDeadline = Date.now() + 180_000;
    const serveCompleteMarkerAtStart = fs.existsSync(path.join(renditionDir(key, 720), ".complete"));
    await rejection.catch(() => {});
    while (Date.now() < settleDeadline) {
      // The 720 (copy) rendition encodes to ~300s; the bogus 7088s expectation
      // must make the pipeline discard it instead of publishing it.
      const complete = fs.existsSync(path.join(renditionDir(key, 720), ".complete"));
      if (!serveCompleteMarkerAtStart && complete) {
        // .complete might only be (re)created by a later re-encode; ensure that
        // a completed-but-invalid rendition never stays published.
        assert.equal(isRenditionReady(key, 720), false);
        break;
      }
      if (!complete && !fs.existsSync(renditionDir(key, 720))) break;
      await wait(1000);
    }
    assert.equal(isRenditionReady(key, 720), false,
      "an invalid (duration-mismatched) rendition must never be served");

    console.log("Transcode integrity test passed: full-length encoding, completion gating,");
    console.log("stale-rendition regeneration, and duration validation all verified.");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
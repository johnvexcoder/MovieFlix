/**
 * T4 — Old-TV playback watchdog.
 *
 * An elderly TV engine that cannot follow a growing HLS event playlist reports
 * a tiny duration and fires `ended` after a few seconds with no frame ever
 * decoded. The legacy portal must NOT treat that as "movie watched" — it must
 * silently fall back to the MP4 source stream.
 *
 * This test forces the portal onto HLS primary by stubbing `canPlayType`
 * before any script runs ("can't do MP4, can do HLS" — exactly the engine the
 * watchdog targets), drives the whole TV journey (QR → profiles → home →
 * title → play), then simulates the fast-fail: a `playing` followed within the
 * window by an `ended` with a tiny `duration` and no decoded frame.
 *
 * Run while `npm run dev` is live at $BASE (default http://localhost:9000):
 *   node tests/tv-player.test.mjs
 */
import { execFileSync } from "node:child_process";
import { JSDOM } from "jsdom";
import { CookieJar } from "tough-cookie";

const BASE = process.env.TEST_BASE || "http://localhost:9000";
const SEED = { username: "tvtest", password: "TvTestPass-1234" };

function assert(cond, msg) {
  if (!cond) throw new Error("assertion failed: " + msg);
}

function waitFor(fn, what, timeoutMs = 40000, interval = 250) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function tick() {
      let val;
      try { val = fn(); } catch (e) { val = undefined; }
      if (val) return resolve(val);
      if (Date.now() - start > timeoutMs) return reject(new Error("timeout waiting for " + what));
      setTimeout(tick, interval);
    })();
  });
}

async function seedFixture() {
  execFileSync("npx", ["tsx", "tests/helpers/seed.ts"], { cwd: process.cwd(), stdio: "inherit" });
  console.log("  fixture seeded (tvtest/TvTestPass-1234)");
}

async function absorbCookies(headerLike, jar, url) {
  const setCookies = headerLike.getSetCookie ? headerLike.getSetCookie() : [];
  for (const sc of setCookies) await jar.setCookie(sc, url).catch(() => {});
}
async function jarCookieHeader(jar, url) {
  return await jar.getCookieString(url);
}

const KEYCODES = {
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
  Enter: 13, OK: 13, Space: 32, Escape: 27,
};
function press(window, key) {
  const ev = new window.KeyboardEvent("keydown", {
    key, keyCode: KEYCODES[key] || 0, which: KEYCODES[key] || 0,
    bubbles: true, cancelable: true,
  });
  window.dispatchEvent(ev);
}

async function portalWatchdogJourney() {
  const dom = await JSDOM.fromURL(BASE + "/legacy-tv.html", {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    cookieJar: new CookieJar(),
    beforeParse(window) {
      // Force the "old TV that can do HLS but not MP4" profile so the watchdog
      // path (HLS primary) is the one being exercised.
      window.HTMLMediaElement.prototype.canPlayType = function (mime) {
        const m = String(mime);
        return m.indexOf("mpegurl") > -1 || m.indexOf("x-mpegURL") > -1 ? "maybe" : "";
      };
    },
  });
  const { window } = dom;
  const doc = window.document;

  /* QA login → claim → profiles. */
  await waitFor(() => {
    const codeEl = doc.querySelector(".code");
    return codeEl && String(codeEl.textContent || "").trim().length >= 4 ? codeEl : null;
  }, "QR code text");
  const qrCodeText = doc.querySelector(".code").textContent.trim();

  const phoneJar = new CookieJar();
  const login = await fetch(BASE + "/api/auth/account-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(SEED),
    redirect: "manual",
  });
  await absorbCookies(login.headers, phoneJar, BASE + "/");
  assert(login.ok, "phone account-login " + login.status);

  const approve = await fetch(BASE + "/api/auth/tv/approve", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: await jarCookieHeader(phoneJar, BASE) },
    body: JSON.stringify({ code: qrCodeText }),
  });
  assert(approve.ok, "tv approve");

  await waitFor(() => {
    const names = Array.from(doc.querySelectorAll(".tile .name")).map((el) => (el.textContent || "").trim());
    return names.some((n) => n.indexOf("Papa") === 0) ? names : null;
  }, "Papa profile tile");

  /* D-pad OK → Papa → home → focus → title detail. */
  press(window, "Enter");
  await waitFor(() => {
    const tiles = doc.querySelectorAll(".tile .name");
    return tiles.length > 0 ? tiles : null;
  }, "home title tiles");

  press(window, "Enter");
  const titleScreen = await waitFor(() => {
    const btn = Array.from(doc.querySelectorAll("button.btn"))
      .find((b) => (b.textContent || "").trim().indexOf("Play") > -1);
    return btn || null;
  }, "title detail with Play button");

  titleScreen.click();

  /* Play → possibly resume-choice (seeded progress) → player with HLS primary. */
  const maybeResume = await waitFor(() => {
    const v = doc.querySelector("video.video");
    if (v && String(v.getAttribute("src") || "").length > 0) return v;
    const resume = Array.from(doc.querySelectorAll("button.btn"))
      .find((b) => (b.textContent || "").indexOf("from the start") > -1);
    return resume || null;
  }, "player video, or resume-choice");
  if (maybeResume.tagName !== "VIDEO") {
    maybeResume.click();
    await waitFor(() => {
      const v = doc.querySelector("video.video");
      return v && String(v.getAttribute("src") || "").length > 0 ? v : null;
    }, "video after resume choice");
  }
  const video = doc.querySelector("video.video");
  const hlsSrc = String(video.getAttribute("src") || "");
  assert(hlsSrc.indexOf("/transcode/720/index.m3u8") > -1,
    "engine allowed HLS primary, got: " + hlsSrc);

  /* Simulate an old HLS engine: playback "starts" (playingSince set) but the
   * stream dies a moment later — tiny duration, no rendered frame `playing`
   * handler sets firstFrame=true but we override duration to look tiny. */
  Object.defineProperty(video, "duration", { configurable: true, get: () => 5 });
  try { video.currentTime = 0; } catch { /* ignore */ }
  video.dispatchEvent(new window.Event("playing"));

  const statusLine = doc.querySelector("video.video").parentElement.querySelector(".status");
  video.dispatchEvent(new window.Event("ended"));

  await waitFor(() => {
    const v = doc.querySelector("video.video");
    return v && String(v.getAttribute("src") || "").indexOf("/stream") > -1 ? v : null;
  }, "fallback to MP4 stream source");

  const finalSrc = String(video.getAttribute("src") || "");
  assert(finalSrc.indexOf("/stream") > -1 && finalSrc.indexOf(".m3u8") === -1,
    "video switched to MP4 stream, got: " + finalSrc);
  const st = window.APP && window.APP.player;
  assert(st && st.fallbackUsed === true, "watchdog marked fallback as used");
  assert(statusLine && /compatible|did not like/.test(statusLine.textContent || ""),
    "status line explains the fallback, got: " + (statusLine && statusLine.textContent));
  assert(window.APP.screen === "player", "movie NOT marked completed (screen=" + window.APP.screen + ")");

  window.close();
  return { qrCodeText, hlsSrc, finalSrc };
}

async function main() {
  await seedFixture();
  const res = await portalWatchdogJourney();
  console.log("PASS watchdog fast-fail | QR=" + res.qrCodeText +
    "\n  hls=" + res.hlsSrc +
    "\n  mp4=" + res.finalSrc);
}

let failures = 0;
for (let i = 0; i < 3; i++) {
  process.stdout.write("=== tv-player run " + (i + 1) + "/3 ===\n");
  try { await main(); }
  catch (e) {
    failures += 1;
    console.error("[run " + (i + 1) + "] FAILED:", e.message);
  }
}
if (failures > 0) process.exit(1);
console.log("\ntv-player test passed 3/3");
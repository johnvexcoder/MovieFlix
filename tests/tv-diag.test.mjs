/**
 * T7 — ?diag=1 engine capability self-diagnostic.
 *
 * Loads the REAL legacy portal with ?diag=1 in jsdom and verifies the
 * capability report renders every probe the TV / support team needs to debug a
 * white screen or a playback problem: ES modules, Promise, fetch, XHR, JSON,
 * localStorage, QR lib, MediaSource/MSE, canPlayType (MP4, H.264 baseline +
 * high, HLS), canvas, performance.now, matchMedia, crypto.randomUUID and the
 * last captured error — plus the "Continue anyway" escape hatch.
 *
 * Run while `npm run dev` is live at $BASE (default http://localhost:9000):
 *   node tests/tv-diag.test.mjs
 */
import { JSDOM } from "jsdom";

const BASE = process.env.TEST_BASE || "http://localhost:9000";

function assert(cond, msg) {
  if (!cond) throw new Error("assertion failed: " + msg);
}
function waitFor(fn, what, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function tick() {
      let val;
      try { val = fn(); } catch (e) { val = undefined; }
      if (val) return resolve(val);
      if (Date.now() - start > timeoutMs) return reject(new Error("timeout waiting for " + what));
      setTimeout(tick, 150);
    })();
  });
}

async function diagReport() {
  const dom = await JSDOM.fromURL(BASE + "/legacy-tv.html?diag=1", {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    cookieJar: undefined, // no session needed for the report
  });
  const w = dom.window;

  await waitFor(() => w.document.querySelector("table.diag tbody tr"), "diag table rows");

  const rows = {};
  w.document.querySelectorAll("table.diag tbody tr").forEach((tr) => {
    const th = tr.querySelector("th");
    const td = tr.querySelector("td");
    if (th && td) rows[th.textContent.trim()] = td.textContent.trim();
  });

  const required = [
    "User agent", "ES modules", "Promise", "fetch", "XMLHttpRequest",
    "JSON", "localStorage", "QR library", "MediaSource (MSE)",
    "canPlayType video/mp4", "canPlayType H.264 baseline",
    "canPlayType H.264 high", "canPlayType HLS", "canvas",
    "performance.now", "matchMedia", "crypto.randomUUID", "Last error",
  ];
  for (const r of required) {
    assert(Object.prototype.hasOwnProperty.call(rows, r), "diag row '" + r + "' missing, got " + JSON.stringify(Object.keys(rows)));
  }
  // Truthfulness spot-checks: the report must mirror what this real engine
  // exposes (computed in-band so the test can never hardcode a lie).
  const checks = [
    ["XMLHttpRequest", typeof w.XMLHttpRequest === "function"],
    ["JSON", typeof w.JSON === "object"],
    ["canPlayType video/mp4", (() => { const v = w.document.createElement("video"); const r = v.canPlayType ? String(v.canPlayType("video/mp4")) : ""; return r || "(none)"; })()],
    ["canvas", (() => { try { const c = w.document.createElement("canvas"); return !!(c.getContext && c.getContext("2d")); } catch (e) { return false; } })()],
    ["performance.now", !!(w.performance && w.performance.now)],
    ["Last error", "(none)"],
  ];
  for (const [label, expected] of checks) {
    const actual = rows[label];
    assert(actual === String(expected),
      "diag row '" + label + "' should report '" + String(expected) + "', got '" + actual + "'");
  }
  // The portal transport itself must be present for the report to be useful.
  assert(rows["XMLHttpRequest"] === "true", "XHR probe reported true (portal transport)");

  // Escape hatch so a real TV can get past the report.
  const cont = Array.from(w.document.querySelectorAll("button"))
    .find((b) => (b.textContent || "").includes("Continue anyway"));
  assert(!!cont, "Continue anyway button present");

  w.close();
  return rows;
}

async function main() {
  const rows = await diagReport();
  console.log("PASS diag | probes=" + Object.keys(rows).length + " lastError='" + rows["Last error"] + "'");
}

let failures = 0;
for (let i = 0; i < 3; i++) {
  process.stdout.write("=== tv-diag run " + (i + 1) + "/3 ===\n");
  try { await main(); }
  catch (e) {
    failures += 1;
    console.error("[run " + (i + 1) + "] FAILED:", e.message);
  }
}
if (failures > 0) process.exit(1);
console.log("\ntv-diag test passed 3/3");
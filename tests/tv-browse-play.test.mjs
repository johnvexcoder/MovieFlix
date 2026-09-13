/**
 * T3 — Legacy TV portal browse→play E2E.
 *
 * Boots the REAL static ES5 portal (`/legacy-tv.html`) in jsdom against the
 * LIVE Next.js dev server, walks the whole user journey with the portal's own
 * XHR transport + shared cookie jar:
 *
 *   QR login → claim → profiles (Papa/Kids) → select Papa (profile-login)
 *      → Home (`/api/home` rows) → open a title (`/api/media/<id>`)
 *      → Play (MP4-first: `video.video[src*="/stream"]`)
 *
 * It also drives the D-pad grid model (Press OK activates the focused cell)
 * via the portal's own `NAV` key handling, not synthetic DOM clicks, so keynav
 * layout is exercised as a TV would.
 *
 * Run while `npm run dev` is live at $BASE (default http://localhost:9000):
 *   node tests/tv-browse-play.test.mjs
 */
import { execFileSync } from "node:child_process";
import { JSDOM } from "jsdom";
import { CookieJar } from "tough-cookie";
import { fileURLToPath } from "node:url";

const BASE = process.env.TEST_BASE || "http://localhost:9000";
const SEED = {
  username: "tvtest",
  password: "TvTestPass-1234",
};

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
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("timeout waiting for " + what));
      }
      setTimeout(tick, interval);
    })();
  });
}

async function seedFixture() {
  execFileSync("npx", ["tsx", "tests/helpers/seed.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
  console.log("  fixture seeded (tvtest/TvTestPass-1234)");
}

async function absorbCookies(headerLike, jar, url) {
  const setCookies = headerLike.getSetCookie ? headerLike.getSetCookie() : [];
  for (const sc of setCookies) {
    await jar.setCookie(sc, url).catch(() => {});
  }
}
async function jarCookieHeader(jar, url) {
  return await jar.getCookieString(url);
}

/* D-pad key event helper — dispatches a real KeyboardEvent on the document,
 * exactly as the portal's NAV handler listens for (it reads e.keyCode). */
const KEYCODES = {
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
  Enter: 13, OK: 13, Space: 32, Escape: 27,
};
function press(window, key) {
  const ev = new window.KeyboardEvent("keydown", {
    key,
    keyCode: KEYCODES[key] || 0,
    which: KEYCODES[key] || 0,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(ev);
}

async function portalBrowseToPlayer() {
  const tvJar = new CookieJar();
  const phoneJar = new CookieJar();

  const dom = await JSDOM.fromURL(BASE + "/legacy-tv.html", {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    cookieJar: tvJar,
  });
  const { window } = dom;

  /* 1. QR shown → phone approves → TV claims → profiles. */
  await waitFor(() => {
    const codeEl = window.document.querySelector(".code");
    return codeEl && String(codeEl.textContent || "").trim().length >= 4 ? codeEl : null;
  }, "QR code text");

  const qrCodeText = window.document.querySelector(".code").textContent.trim();
  assert(qrCodeText.length >= 4, "QR code >= 4 chars");

  const phoneLogin = await fetch(BASE + "/api/auth/account-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: SEED.username, password: SEED.password }),
    redirect: "manual",
  });
  await absorbCookies(phoneLogin.headers, phoneJar, BASE + "/");
  assert(phoneLogin.ok, "phone account-login " + phoneLogin.status);

  const approve = await fetch(BASE + "/api/auth/tv/approve", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: await jarCookieHeader(phoneJar, BASE) },
    body: JSON.stringify({ code: qrCodeText }),
  });
  await absorbCookies(approve.headers, phoneJar, BASE + "/");
  const approveJson = await approve.json().catch(() => ({}));
  assert(approve.ok, "tv approve failed: " + JSON.stringify(approveJson));

  await waitFor(() => {
    const names = Array.from(window.document.querySelectorAll(".tile .name"))
      .map((el) => (el.textContent || "").trim());
    return names.some((n) => n.indexOf("Papa") === 0) ? names : null;
  }, "Papa profile tile");

  /* 2. Use D-pad: OK opens the focused profile (Papa — first grid cell). */
  press(window, "Enter");
  await waitFor(() => {
    const status = window.document.querySelector(".status");
    return status && (status.textContent || "").indexOf("Signing in") > -1 ? status : null;
  }, "profile-login status line");

  /* 3. Home rows render with titles. */
  const homeRows = await waitFor(() => {
    const tiles = window.document.querySelectorAll(".tile .name");
    return tiles.length > 0 ? tiles : null;
  }, "home title tiles");
  const titlesOnHome = Array.from(homeRows).map((el) => (el.textContent || "").trim());
  assert(titlesOnHome.length > 0, "home shows at least one title");

  /* 4. D-pad: open the focused cell (Featured → a title detail). */
  press(window, "Enter");
  const titleScreen = await waitFor(() => {
    const btn = Array.from(window.document.querySelectorAll("button.btn"))
      .find((b) => (b.textContent || "").trim().indexOf("Play") > -1);
    return btn || null;
  }, "title detail with Play button");
  assert(!!titleScreen, "title detail has a Play button");

  /* 5. Play → player (or resume-choice first, which also has a Play action). */
  titleScreen.click();
  const maybeResume = await waitFor(() => {
    const v = window.document.querySelector("video.video");
    if (v && String(v.getAttribute("src") || "").length > 0) return v;
    const resume = Array.from(window.document.querySelectorAll("button.btn"))
      .find((b) => (b.textContent || "").indexOf("from the start") > -1);
    return resume || null;
  }, "player video, or resume-choice");
  let playerEl = maybeResume;
  if (playerEl && playerEl.tagName !== "VIDEO") {
    playerEl.click();
    playerEl = await waitFor(() => {
      const v = window.document.querySelector("video.video");
      return v && String(v.getAttribute("src") || "").length > 0 ? v : null;
    }, "video after resume choice");
  }
  const videoSrc = String(window.document.querySelector("video.video").getAttribute("src"));
  assert(videoSrc.indexOf("/api/media/") === 0 && videoSrc.indexOf("/stream") > -1,
    "MP4-first source selected, got: " + videoSrc);
  const statusLine = window.document.querySelector("video.video").parentElement
    .querySelector(".status");
  assert(!!statusLine, "player has a status line");

  window.close();
  return { qrCodeText, titlesOnHome, videoSrc };
}

async function main() {
  await seedFixture();
  const res = await portalBrowseToPlayer();
  console.log("PASS browse→play | QR=" + res.qrCodeText +
    " homeTitles=" + res.titlesOnHome.length +
    " src=" + res.videoSrc);
}

let failures = 0;
for (let i = 0; i < 3; i++) {
  process.stdout.write("=== tv-browse-play run " + (i + 1) + "/3 ===\n");
  try { await main(); }
  catch (e) {
    failures += 1;
    console.error("[run " + (i + 1) + "] FAILED:", e.message);
  }
}
if (failures > 0) { process.exit(1); }
console.log("\ntv-browse-play test passed 3/3");
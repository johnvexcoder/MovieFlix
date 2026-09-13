/**
 * Old-TV login by username/password — the classic fallback besides QR.
 *
 * Boots the REAL ES5 portal (`/legacy-tv.html` + `public/legacy-tv.js`) in
 * jsdom against the LIVE Next.js dev server, then drives the sign-in FORM
 * (not the QR flow): the login screen must offer both a QR code AND a
 * username + password form, POSTs go through the portal's own XHR to
 * `/api/auth/account-login`, and on success the portal lands on the profile
 * picker (Papa tile visible), exactly like the QR path.
 *
 * Run while `npm run dev` is live at $BASE (default http://localhost:9000):
 *   node tests/tv-login-form.test.mjs
 */
import { execFileSync } from "node:child_process";
import { JSDOM } from "jsdom";
import { CookieJar } from "tough-cookie";
import { fileURLToPath } from "node:url";

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
      try { val = fn(); } catch { val = undefined; }
      if (val) return resolve(val);
      if (Date.now() - start > timeoutMs) return reject(new Error("timeout waiting for " + what));
      setTimeout(tick, interval);
    })();
  });
}

async function seedFixture() {
  execFileSync("npx", ["tsx", "tests/helpers/seed.ts"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

async function portalLoginFormFlow() {
  const tvJar = new CookieJar();
  const dom = await JSDOM.fromURL(BASE + "/legacy-tv.html", {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    cookieJar: tvJar,
  });
  const { window } = dom;

  /* 1. Login screen: QR code AND the classic password form must coexist. */
  await waitFor(() => {
    const codeEl = window.document.querySelector(".code");
    return codeEl && String(codeEl.textContent || "").trim().length >= 4 ? codeEl : null;
  }, "QR code text (login screen)");

  const inputs = await waitFor(() => {
    const tvin = window.document.querySelectorAll("input.tvin");
    return tvin.length >= 2 ? tvin : null;
  }, "username + password inputs on login screen");

  const buttons = Array.from(window.document.querySelectorAll("button.btn"))
    .map((b) => (b.textContent || "").trim());
  assert(buttons.some((t) => t.indexOf("Sign In") > -1),
    "login screen has a Sign In button, got " + JSON.stringify(buttons));

  const [fname, fpass] = Array.from(inputs);
  const code = window.document.querySelector(".code").textContent.trim();

  /* 2. Bad credentials → inline error, still on the login screen. */
  fname.value = SEED.username;
  fpass.value = "wrong-password";
  Array.from(window.document.querySelectorAll("button.btn"))
    .find((b) => (b.textContent || "").trim().indexOf("Sign In") > -1).click();
  const errLine = await waitFor(() => {
    const st = window.document.querySelector(".err, .status.err");
    return st && String(st.textContent || "").trim().length > 0 ? st : null;
  }, "inline error for bad login");
  assert(/invalid|incorrect|could not|failed|error/i.test(errLine.textContent),
    "bad login surfaces an error, got: " + errLine.textContent);
  assert(!!window.document.querySelector(".code"), "still on login screen after failure");

  /* 3. Correct credentials → profile picker appears (like the QR path). */
  fpass.value = SEED.password;
  Array.from(window.document.querySelectorAll("button.btn"))
    .find((b) => (b.textContent || "").trim().indexOf("Sign In") > -1).click();
  const tiles = await waitFor(() => {
    const names = Array.from(window.document.querySelectorAll(".tile .name"))
      .map((el) => (el.textContent || "").trim());
    return names.some((n) => n.indexOf("Papa") === 0) ? names : null;
  }, "Papa profile tile after form login");
  assert(tiles.some((n) => n.indexOf("Kids") === 0),
    "profiles list includes Kids, got " + JSON.stringify(tiles));

  window.close();
  return { code, tiles };
}

async function main() {
  await seedFixture();
  const res = await portalLoginFormFlow();
  console.log("PASS tv-login-form | QR code + form login -> profiles=" + JSON.stringify(res.tiles));
}

let failures = 0;
for (let i = 0; i < 3; i++) {
  process.stdout.write("=== tv-login-form run " + (i + 1) + "/3 ===\n");
  try { await main(); }
  catch (e) {
    failures += 1;
    console.error("[run " + (i + 1) + "] FAILED:", e.message);
  }
}
if (failures > 0) process.exit(1);
console.log("\ntv-login-form test passed 3/3");
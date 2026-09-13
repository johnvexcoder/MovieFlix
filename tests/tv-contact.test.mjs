/**
 * Old-TV Report a Problem + Give Feedback (Settings → /api/contact).
 *
 * Boots the REAL ES5 portal, signs in via the password FORM (validates that
 * path again), opens Papa → Home, D-pads down to Settings, opens Report a
 * Problem and Give Feedback, fills both forms, and submits through the
 * portal's XHR to `/api/contact`. Both must land on a thank-you state.
 *
 * Run while `npm run dev` is live at $BASE (default http://localhost:9000):
 *   node tests/tv-contact.test.mjs
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

function waitFor(fn, what, timeoutMs = 45000, interval = 250) {
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

async function formLoginToHome() {
  const jar = new CookieJar();
  const dom = await JSDOM.fromURL(BASE + "/legacy-tv.html", {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    cookieJar: jar,
  });
  const { window } = dom;

  await waitFor(() => {
    const inputs = window.document.querySelectorAll("input.tvin");
    return inputs.length >= 2 ? inputs : null;
  }, "login form inputs");

  const [fname, fpass] = window.document.querySelectorAll("input.tvin");
  fname.value = SEED.username;
  fpass.value = SEED.password;
  Array.from(window.document.querySelectorAll("button.btn"))
    .find((b) => (b.textContent || "").trim().indexOf("Sign In") > -1).click();

  await waitFor(() => {
    const names = Array.from(window.document.querySelectorAll(".tile .name"))
      .map((el) => (el.textContent || "").trim());
    return names.some((n) => n.indexOf("Papa") === 0) ? names : null;
  }, "Papa tile after form login");

  press(window, "Enter");
  await waitFor(() => {
    const tiles = window.document.querySelectorAll(".tile .name");
    return tiles.length > 0 ? tiles : null;
  }, "home title tiles");
  return { window, jar };
}

async function navigateDownToSettings(window) {
  const MAX = 80;
  for (let i = 0; i < MAX; i++) {
    const focused = Array.from(window.document.querySelectorAll("button.btn.focused"))
      .map((b) => (b.textContent || "").trim()).join(" ");
    if (focused.indexOf("Settings: Payment") > -1) return;
    press(window, "ArrowDown");
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error("could not reach Settings row from Home");
}

async function openSettingsOption(window, label) {
  const btn = Array.from(window.document.querySelectorAll("button.opt"))
    .find((b) => (b.textContent || "").trim().indexOf(label) > -1);
  assert(!!btn, "settings has '" + label + "' option");
  btn.click();
}

async function fillAndSubmitContact(window, opts) {
  await waitFor(() => {
    const textarea = window.document.querySelector("textarea.tvin");
    return textarea || null;
  }, "contact form with message textarea");

  const textarea = window.document.querySelector("textarea.tvin");
  const subject = window.document.querySelector("input.tvin");
  const submit = Array.from(window.document.querySelectorAll("button.btn"))
    .find((b) => (b.textContent || "").trim() === opts.submitLabel);
  assert(!!submit, "submit button labeled '" + opts.submitLabel + "'");
  assert(!!textarea, "message textarea present");
  assert(!!subject, "subject input present");

  subject.value = opts.subject;
  textarea.value = opts.message;
  submit.click();

  const okStatus = await waitFor(() => {
    const st = window.document.querySelector(".status.payok, .status.ok");
    return st && /Thank you|received|Thank You/i.test(st.textContent || "") ? st : null;
  }, "thank-you status for " + opts.label);
  assert(/Thank you/i.test(okStatus.textContent || ""),
    "thank-you text, got: " + okStatus.textContent);

  /* Back to Settings so the next option can be exercised. */
  const back = Array.from(window.document.querySelectorAll("button.btn"))
    .find((b) => (b.textContent || "").trim().indexOf("Back to Settings") > -1);
  assert(!!back, "back-to-settings button present");
  back.click();
  await waitFor(() => {
    const opts2 = Array.from(window.document.querySelectorAll("button.opt"))
      .map((b) => (b.textContent || "").trim());
    return opts2.some((t) => t.indexOf("Payment / Plans") > -1) ? opts2 : null;
  }, "settings menu again after back");
}

async function main() {
  await seedFixture();
  const { window } = await formLoginToHome();

  await navigateDownToSettings(window);
  press(window, "Enter");
  await waitFor(() => {
    const opts = Array.from(window.document.querySelectorAll(".opt"))
      .map((b) => (b.textContent || "").trim());
    return opts.some((t) => t.indexOf("Payment / Plans") > -1) ? opts : null;
  }, "settings menu");

  await openSettingsOption(window, "Report a Problem");
  await fillAndSubmitContact(window, {
    label: "report",
    submitLabel: "Submit Report",
    subject: "Buffering on TV",
    message: "The movie buffers every 20 seconds on my old TV. Please look into it.",
  });

  await openSettingsOption(window, "Give Feedback");
  await fillAndSubmitContact(window, {
    label: "feedback",
    submitLabel: "Send Feedback",
    subject: "Love the app",
    message: "The TV experience is great once I set things up. Adding more classic titles would be nice.",
  });

  window.close();
  console.log("PASS tv-contact | report + feedback both submitted through the portal");
}

let failures = 0;
for (let i = 0; i < 3; i++) {
  process.stdout.write("=== tv-contact run " + (i + 1) + "/3 ===\n");
  try { await main(); }
  catch (e) {
    failures += 1;
    console.error("[run " + (i + 1) + "] FAILED:", e.message);
  }
}
if (failures > 0) process.exit(1);
console.log("\ntv-contact test passed 3/3");
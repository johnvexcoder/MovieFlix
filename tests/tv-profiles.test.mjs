/**
 * T5 — 10-foot Create/Edit Profile E2E in the legacy portal.
 *
 * Boots the REAL ES5 portal in jsdom against the LIVE dev server, signs in via
 * QR/claim, then drives profile management through the on-screen UI:
 *
 *   profiles → Manage Profiles → + Add Profile → build name on the D-pad
 *     keyboard (A-Z/SPACE/DEL), pick an avatar, set a 4-digit PIN on the pad,
 *     Save → POST /api/account/profiles → new tile appears.
 *   → Manage Profiles → edit the new profile (DEL + retype, new avatar)
 *     → Save → PUT /api/profiles/<id> → renamed tile + avatar persisted.
 *
 * Desktop/mobile UIs are untouched by design; this validates the TV-only
 * surface. Run while `npm run dev` is live:
 *   node tests/tv-profiles.test.mjs
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
async function absorbCookies(headerLike, jar, url) {
  const setCookies = headerLike.getSetCookie ? headerLike.getSetCookie() : [];
  for (const sc of setCookies) await jar.setCookie(sc, url).catch(() => {});
}
async function jarCookieHeader(jar, url) { return await jar.getCookieString(url); }

const KEYCODES = { ArrowDown: 40, ArrowRight: 39, Enter: 13, OK: 13 };
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

async function signInTv(dom) {
  const { window } = dom;
  await waitFor(() => {
    const c = window.document.querySelector(".code");
    return c && String(c.textContent || "").trim().length >= 4 ? c : null;
  }, "QR code");
  const code = window.document.querySelector(".code").textContent.trim();
  const phoneJar = new CookieJar();
  const login = await fetch(BASE + "/api/auth/account-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: SEED.username, password: SEED.password }),
    redirect: "manual",
  });
  await absorbCookies(login.headers, phoneJar, BASE + "/");
  assert(login.ok, "phone account-login " + login.status);
  const approve = await fetch(BASE + "/api/auth/tv/approve", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: await jarCookieHeader(phoneJar, BASE) },
    body: JSON.stringify({ code }),
  });
  assert(approve.ok, "approve failed");
  await waitFor(() => {
    const names = Array.from(window.document.querySelectorAll(".tile .name"))
      .map((el) => (el.textContent || "").trim());
    return names.some((n) => n.indexOf("Papa") === 0) ? names : null;
  }, "profiles screen (Papa tile)");
  return code;
}

function clickKeys(window, texts) {
  for (const t of texts) {
    const btn = Array.from(window.document.querySelectorAll(".kb .key"))
      .find((b) => (b.textContent || "").trim() === t);
    assert(btn, "keyboard key '" + t + "' not found");
    btn.click();
  }
}

async function portalProfileCrud() {
  const tvJar = new CookieJar();
  const dom = await JSDOM.fromURL(BASE + "/legacy-tv.html", {
    resources: "usable",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    cookieJar: tvJar,
  });
  const w = dom.window;
  await signInTv(dom);

  /* D-pad: Down once reaches the util row → OK opens Manage Profiles. */
  press(w, "ArrowDown");
  press(w, "Enter");
  await waitFor(() => {
    const add = Array.from(w.document.querySelectorAll("button"))
      .find((b) => (b.textContent || "").trim() === "+ Add Profile");
    return add ? add : null;
  }, "manage screen (+ Add Profile)");

  /* Down to the add row (row 1: [Add, Back]) → OK → Create Profile form. */
  press(w, "ArrowDown");
  press(w, "Enter");
  await waitFor(() => {
    const h = w.document.querySelector(".panel h1");
    return h && (h.textContent || "").indexOf("Create Profile") > -1 ? h : null;
  }, "create profile form");

  /* Type "ZOO HQ" on the on-screen keyboard (8 chars, under the 20 limit). */
  clickKeys(w, ["Z", "O", "O", "SPACE", "H", "Q"]);
  const nameLine = w.document.querySelector(".name-line");
  assert((nameLine.textContent || "").trim() === "ZOO HQ", "name-line shows typed name, got '" + nameLine.textContent + "'");

  /* Pick the trophy avatar (mirrors src/lib/avatars.ts id "trophy"). */
  const avatarBtns = Array.from(w.document.querySelectorAll(".avatar-row button.avatar"));
  assert(avatarBtns.length >= 28, "avatar picker shows all options, got " + avatarBtns.length);
  avatarBtns.find((b) => (b.textContent || "").trim() === "\u{1F3C6}").click();

  /* Set a 4-digit PIN via the pad (Set a PIN → 1 2 3 4 → commit). */
  const pinToggle = Array.from(w.document.querySelectorAll(".pin-row button"))
    .find((b) => (b.textContent || "").trim() === "Set a PIN");
  pinToggle.click();
  await waitFor(() => w.document.querySelector(".pin-setter .pins"), "PIN setter pad");
  const numBtns = (n) => Array.from(w.document.querySelectorAll(".pin-setter .key.num"))
    .filter((b) => (b.textContent || "").trim() === String(n));
  for (const d of ["1", "2", "3", "4"]) numBtns(d)[0].click();
  await waitFor(() => {
    const t = Array.from(w.document.querySelectorAll(".pin-row button"))
      .find((b) => (b.textContent || "").trim() === "Clear PIN");
    return t ? t : null;
  }, "PIN committed (Clear PIN toggle)");

  /* D-pad: down twice from keyboard row 0 (A–M) → Save (row 2) → OK. */
  press(w, "ArrowDown");
  press(w, "ArrowDown");
  press(w, "Enter");

  /* Back on profiles: "ZOO HQ" tile should exist. */
  await waitFor(() => {
    const names = Array.from(w.document.querySelectorAll(".tile .name"))
      .map((el) => (el.textContent || "").trim());
    return names.some((n) => n.indexOf("ZOO HQ") === 0) ? names : null;
  }, "new profile tile (ZOO HQ)");

  /* Verify persisted via HTTP with the TV session. */
  const profs = await fetch(BASE + "/api/account/profiles", {
    headers: { cookie: await jarCookieHeader(tvJar, BASE) },
  });
  assert(profs.ok, "profiles fetch " + profs.status);
  const list = ((await profs.json()).data || {}).profiles || [];
  const created = list.find((p) => p.name === "ZOO HQ");
  assert(created && created.avatarUrl === "trophy", "created profile persisted with trophy avatar, got " + JSON.stringify(created));

  /* Edit the new profile: Manage → ZOO HQ tile → DEL x6 → type "ZOO" → new
   * avatar (cat) → Save → PUT. */
  press(w, "ArrowDown");
  press(w, "Enter");
  await waitFor(() => {
    const add = Array.from(w.document.querySelectorAll("button"))
      .find((b) => (b.textContent || "").trim() === "+ Add Profile");
    return add ? add : null;
  }, "manage screen again");
  const zooTile = Array.from(w.document.querySelectorAll(".tile .name"))
    .find((el) => (el.textContent || "").trim().indexOf("ZOO HQ") === 0);
  assert(!!zooTile, "ZOO HQ tile in manage");
  zooTile.closest(".tile").click();
  await waitFor(() => {
    const h = w.document.querySelector(".panel h1");
    return h && (h.textContent || "").indexOf("Edit Profile") > -1 ? h : null;
  }, "edit profile form");
  const nameRead = w.document.querySelector(".name-line");
  assert((nameRead.textContent || "").trim() === "ZOO HQ", "edit form prefilled, got '" + nameRead.textContent + "'");

  clickKeys(w, ["\u232B", "\u232B", "\u232B", "\u232B", "\u232B", "\u232B"]);
  clickKeys(w, ["Z", "O", "O"]);
  assert((w.document.querySelector(".name-line").textContent || "").trim() === "ZOO", "renamed in form");
  Array.from(w.document.querySelectorAll(".avatar-row button.avatar"))
    .find((b) => (b.textContent || "").trim() === "\u{1F431}").click();

  press(w, "ArrowDown");
  press(w, "ArrowDown");
  press(w, "Enter");

  await waitFor(() => {
    const names = Array.from(w.document.querySelectorAll(".tile .name"))
      .map((el) => (el.textContent || "").trim());
    return names.some((n) => n.indexOf("ZOO") === 0 && n.indexOf("ZOO HQ") === -1) ? names : null;
  }, "renamed tile (ZOO)");

  const profs2 = await fetch(BASE + "/api/account/profiles", {
    headers: { cookie: await jarCookieHeader(tvJar, BASE) },
  });
  const list2 = ((await profs2.json()).data || {}).profiles || [];
  const edited = list2.find((p) => p.name === "ZOO");
  assert(edited && edited.avatarUrl === "cat", "edited profile persisted (ZOO/cat), got " + JSON.stringify(edited));
  assert(!list2.find((p) => p.name === "ZOO HQ"), "old name gone after PUT");

  w.close();
  return { created: list2.find((p) => p.name === "ZOO") };
}

async function main() {
  execFileSync("npx", ["tsx", "tests/helpers/seed.ts"], { cwd: process.cwd(), stdio: "inherit" });
  const res = await portalProfileCrud();
  console.log("PASS create+edit profile | persisted=" + JSON.stringify(res.created));
}

let failures = 0;
for (let i = 0; i < 3; i++) {
  process.stdout.write("=== tv-profiles run " + (i + 1) + "/3 ===\n");
  try { await main(); }
  catch (e) {
    failures += 1;
    console.error("[run " + (i + 1) + "] FAILED:", e.message);
  }
}
if (failures > 0) process.exit(1);
console.log("\ntv-profiles test passed 3/3");
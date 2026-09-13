/**
 * T6 — Secure Scan-to-Sign-In: QR is TV-only + approve is auth-gated.
 *
 *  1. Gate: `/tv/login` never mints or renders a QR unless the requesting
 *     browser is a Smart TV (useTvMode). Phones/desktop get the password form
 *     and a "sign in on your TV" panel — verifiable in the page source and in
 *     exported constants.
 *  2. Contract: a challenge can be created by anyone, but APPROVAL requires an
 *     authenticated account session (a logged-out phone gets 401). CLAIM then
 *     requires the claimToken that is only issued to the TV after approval.
 *  3. The approval URL is built server-side from the canonical public URL, so
 *     a malicious TV cannot phish an approve page.
 *
 * Run while `npm run dev` is live at $BASE (default http://localhost:9000):
 *   node tests/tv-login-security.test.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = process.env.TEST_BASE || "http://localhost:9000";
const ROOT = process.cwd();

function assert(cond, msg) {
  if (!cond) throw new Error("assertion failed: " + msg);
}

async function seedFixture() {
  execFileSync("npx", ["tsx", "tests/helpers/seed.ts"], {
    cwd: ROOT,
    stdio: "inherit",
  });
}

/* 1) QR gating in /tv/login — static contract of the TV-only flow. */
function tvLoginSourceGate() {
  const src = readFileSync(
    fileURLToPath(new URL("../src/app/tv/login/page.tsx", import.meta.url)),
    "utf8"
  );
  assert(/useTvMode\(\)/.test(src), "tv/login uses useTvMode()");
  assert(/if \(!isTv\)/.test(src), "QR flow is guarded by !isTv");
  assert(/setStatus\("ready"\);/.test(src), "non-TV branch sits idle (no QR)");
  // The QR render must be behind the same gate.
  const renderQrSection = src.split("const renderQrPanel = () => {")[1] || "";
  const nonTvBlock = renderQrSection.split("if (!isTv) {")[1] || "";
  assert(/Monitor/.test(nonTvBlock), "non-TV panel explains TV-only flow");
  assert(!/toDataURL/.test(nonTvBlock.split("if (status")[0]),
    "no QR generation for non-TV browsers");
  // Expiry must rotate silently — never dead-end the user on an "expired" wall.
  assert(/const regenerate = useCallback\(/.test(src), "codes auto-mint a replacement");
  assert(/if \(left <= 0\)/.test(src) && /regenerate\(\);/.test(src),
    "countdown expiry rotates the code");
  assert(/res\.status === 404[\s\S]{0,120}regenerate\(\);/.test(src),
    "poll 404 rotates the code");
  assert(!/setStatus\("expired"\)/.test(src), "no dead-end expired screen remains");
  assert(/expiresIn \|\| 300/.test(src), "client TTL default matches 5-minute server TTL");
}

/* 1b) The ES5 portal must also rotate an expired code instead of stopping. */
function legacyAutoRegenGate() {
  const legacy = readFileSync(
    fileURLToPath(new URL("../public/legacy-tv.js", import.meta.url)),
    "utf8"
  );
  assert(/function expired\(\)[\s\S]{0,220}startQr\(\);/.test(legacy),
    "legacy portal rotates an expired code");
  assert(!/Code expired\. Generate a new one\./.test(legacy),
    "legacy portal no longer dead-ends on expiry");
  assert(/function startQr\(\)/.test(legacy), "legacy portal can mint a fresh code");
}

/* 2) Approve requires auth; claim requires claimToken. */
async function securityContract() {
  // Anyone may mint a challenge (cheap, 5-min TTL, single-use).
  const qr = await fetch(BASE + "/api/auth/tv/qr", { method: "POST" });
  const qrJson = await qr.json();
  assert(qr.ok && qrJson.data && qrJson.data.code, "challenge minted");
  assert(qrJson.data.expiresIn === 300, "challenge TTL is 5 minutes, got " + qrJson.data.expiresIn);
  const code = qrJson.data.code;
  assert(
    /^https:\/\//.test(qrJson.data.qrUrl) || /^http:\/\//.test(qrJson.data.qrUrl),
    "approval URL is an absolute server-asserted URL"
  );

  // Logged-out phone: approve MUST be refused.
  const anonApprove = await fetch(BASE + "/api/auth/tv/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code }),
    redirect: "manual",
  });
  assert(anonApprove.status !== 200, "unauthenticated approve must not succeed, got " + anonApprove.status);

  // Authenticated phone: approve succeeds and issues a claimToken.
  const login = await fetch(BASE + "/api/auth/account-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "tvtest", password: "TvTestPass-1234" }),
    redirect: "manual",
  });
  assert(login.ok, "phone login");
  const phoneCookie = login.headers.getSetCookie().map((s) => s.split(";")[0]).join("; ");

  const approve = await fetch(BASE + "/api/auth/tv/approve", {
    method: "POST",
    headers: { "content-type": "application/json", cookie: phoneCookie },
    body: JSON.stringify({ code }),
  });
  const approveJson = await approve.json();
  assert(approve.ok && approveJson.data && approveJson.data.approved === true,
    "authed approve accepted, got " + JSON.stringify(approveJson));

  // The TV's status poll then surfaces the claimToken tied to approval.
  const status = await fetch(BASE + "/api/auth/tv/status?code=" + encodeURIComponent(code));
  const statusJson = await status.json();
  assert(statusJson.data && statusJson.data.status === "approved" && statusJson.data.claimToken,
    "status exposes claimToken after approval, got " + JSON.stringify(statusJson));
  const claimToken = statusJson.data.claimToken;

  // TV claims with a WRONG token → rejected.
  const badClaim = await fetch(BASE + "/api/auth/tv/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, claimToken: "not-the-token" }),
    redirect: "manual",
  });
  assert(badClaim.status !== 200, "claim with wrong token must fail, got " + badClaim.status);

  // Correct token → session established.
  const claim = await fetch(BASE + "/api/auth/tv/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, claimToken }),
    redirect: "manual",
  });
  assert(claim.ok, "claim with correct token accepted");
  return { code };
}

async function main() {
  await seedFixture();
  tvLoginSourceGate();
  legacyAutoRegenGate();
  const res = await securityContract();
  console.log("PASS qr-gate + auto-regen + approve/claim security | code=" + res.code);
}

let failures = 0;
for (let i = 0; i < 3; i++) {
  process.stdout.write("=== tv-login-security run " + (i + 1) + "/3 ===\n");
  try { await main(); }
  catch (e) {
    failures += 1;
    console.error("[run " + (i + 1) + "] FAILED:", e.message);
  }
}
if (failures > 0) process.exit(1);
console.log("\ntv-login-security test passed 3/3");
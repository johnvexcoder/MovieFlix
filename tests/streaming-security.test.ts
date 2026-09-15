import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "movieflix-playback-test-"));
Object.assign(process.env, { NODE_ENV: "test", DATABASE_PATH: path.join(temp, "db.sqlite"),
  STREAMING_OUTPUT_DIR: path.join(temp, "streaming"), STREAMING_V2_ENABLED: "true",
  JWT_SECRET: "test-playback-secret-that-is-long-and-unique-123",
  JWT_REFRESH_SECRET: "test-refresh-secret-that-is-long-and-unique-456" });

async function main() {
  try {
    const { db, setupDatabase } = await import("../src/db/index");
    const { accounts, profiles, media, mediaStreamPackages } = await import("../src/db/schema");
    const { generateAccessToken } = await import("../src/lib/auth");
    const { packageDirectory } = await import("../src/streaming/storage");
    const { POST } = await import("../src/app/api/playback/session/route");
    const { GET } = await import("../src/app/api/streaming/[packageId]/[...asset]/route");
    const { eq } = await import("drizzle-orm");
    setupDatabase();
    const now = new Date().toISOString();
    await db.insert(accounts).values({ id: "account-1", username: "customer", passwordHash: "x",
      registrationStatus: "active", createdAt: now, updatedAt: now });
    await db.insert(profiles).values({ id: "profile-1", accountId: "account-1", name: "Viewer",
      createdAt: now, updatedAt: now });
    await db.insert(media).values({ id: "media-1", type: "movie", title: "Fixture",
      filePath: path.join(temp, "source.mp4"), createdAt: now, updatedAt: now });
    const packageId = crypto.randomUUID();
    await db.insert(mediaStreamPackages).values({ id: packageId, mediaId: "media-1", version: 1,
      status: "READY", sourceFingerprint: "fixture", renditionsJson: "[]", createdAt: now, updatedAt: now });
    const dir = packageDirectory("media-1", null, 1);
    fs.mkdirSync(path.join(dir, "360p"), { recursive: true });
    fs.writeFileSync(path.join(dir, "master.m3u8"), "#EXTM3U\n360p/index.m3u8\n");
    fs.writeFileSync(path.join(dir, "360p", "index.m3u8"), "#EXTM3U\nseg-000001.m4s\n");
    fs.writeFileSync(path.join(dir, "360p", "init.mp4"), "init");
    fs.writeFileSync(path.join(dir, "360p", "seg-000001.m4s"), "segment");
    const body = JSON.stringify({ mediaId: "media-1", profileId: "profile-1" });
    const unauthorized = await POST(new NextRequest("http://localhost/api/playback/session",
      { method: "POST", body }));
    assert.equal(unauthorized.status, 401);
    const token = generateAccessToken({ profileId: "profile-1", accountId: "account-1",
      isAdmin: false, fingerprint: "test" });
    const response = await POST(new NextRequest("http://localhost/api/playback/session",
      { method: "POST", body, headers: { cookie: `access_token=${token}` } }));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).mode, "hls");
    const playbackCookie = response.cookies.get("mvf_playback")?.value;
    assert(playbackCookie);
    const request = (cookie: string) => new NextRequest(`http://localhost/api/streaming/${packageId}/360p/seg-000001.m4s`,
      { headers: { cookie } });
    const params = { params: Promise.resolve({ packageId, asset: ["360p", "seg-000001.m4s"] }) };
    assert.equal((await GET(request(""), params)).status, 401);
    assert.equal((await GET(request(`mvf_playback=${playbackCookie}`), params)).status, 200);
    const partial = await GET(new NextRequest(`http://localhost/api/streaming/${packageId}/360p/seg-000001.m4s`,
      { headers: { cookie: `mvf_playback=${playbackCookie}`, range: "bytes=0-2" } }), params);
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("content-range"), "bytes 0-2/7");
    assert.equal(await partial.text(), "seg");
    assert.equal((await GET(request(`mvf_playback=${playbackCookie}`),
      { params: Promise.resolve({ packageId: crypto.randomUUID(), asset: ["360p", "seg-000001.m4s"] }) })).status, 401);
    await db.update(accounts).set({ isLocked: true }).where(eq(accounts.id, "account-1"));
    assert.equal((await GET(request(`mvf_playback=${playbackCookie}`), params)).status, 403);
    console.log("Streaming playback scope and account revocation passed");
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });

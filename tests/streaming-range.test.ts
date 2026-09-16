import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "movieflix-range-test-"));
Object.assign(process.env, {
  NODE_ENV: "test",
  DATABASE_PATH: path.join(temp, "db.sqlite"),
  STREAMING_OUTPUT_DIR: path.join(temp, "streaming"),
  STREAMING_V2_ENABLED: "true",
  JWT_SECRET: "test-range-secret-that-is-long-and-unique-123",
  JWT_REFRESH_SECRET: "test-range-refresh-secret-that-is-long-456",
});

// 9MB deliberately exceeds the old 8MB chunk cap so an open-ended range that is
// still capped would fail the full-remainder assertion below.
const FILE_SIZE = 9 * 1024 * 1024;

async function main() {
  try {
    const { db, setupDatabase } = await import("../src/db/index");
    const { media } = await import("../src/db/schema");
    const { generateAccessToken } = await import("../src/lib/auth");
    const { GET } = await import("../src/app/api/media/[id]/stream/route");
    setupDatabase();
    const now = new Date().toISOString();
    const sourceFile = path.join(temp, "source.mp4");
    fs.writeFileSync(sourceFile, Buffer.alloc(FILE_SIZE, 1));
    await db.insert(media).values({
      id: "media-1", type: "movie", title: "Big Fixture",
      filePath: sourceFile, createdAt: now, updatedAt: now,
    });
    const token = generateAccessToken({ profileId: "profile-1", accountId: "account-1",
      isAdmin: false, fingerprint: "test" });
    const url = "http://localhost/api/media/media-1/stream";
    const params = { params: Promise.resolve({ id: "media-1" }) };
    const get = (headers: Record<string, string>) =>
      GET(new NextRequest(url, { headers: { cookie: `access_token=${token}`, ...headers } }), params);

    const noRange = await get({});
    assert.equal(noRange.status, 200);
    assert.equal(noRange.headers.get("content-length"), String(FILE_SIZE));

    const openEnded = await get({ range: "bytes=0-" });
    assert.equal(openEnded.status, 206);
    assert.equal(openEnded.headers.get("content-range"), `bytes 0-${FILE_SIZE - 1}/${FILE_SIZE}`);
    assert.equal(openEnded.headers.get("content-length"), String(FILE_SIZE));
    assert.equal((await openEnded.arrayBuffer()).byteLength, FILE_SIZE);

    const midOpenEnded = await get({ range: `bytes=${FILE_SIZE - 100}-` });
    assert.equal(midOpenEnded.status, 206);
    assert.equal(midOpenEnded.headers.get("content-range"), `bytes ${FILE_SIZE - 100}-${FILE_SIZE - 1}/${FILE_SIZE}`);
    assert.equal((await midOpenEnded.arrayBuffer()).byteLength, 100);

    const bounded = await get({ range: "bytes=0-1048575" });
    assert.equal(bounded.status, 206);
    assert.equal(bounded.headers.get("content-length"), String(1024 * 1024));
    assert.equal((await bounded.arrayBuffer()).byteLength, 1024 * 1024);

    const suffix = await get({ range: "bytes=-64" });
    assert.equal(suffix.status, 206);
    assert.equal(suffix.headers.get("content-range"), `bytes ${FILE_SIZE - 64}-${FILE_SIZE - 1}/${FILE_SIZE}`);

    console.log("Direct stream range handling passed");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });

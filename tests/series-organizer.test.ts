import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "movieflix-series-test-"));
process.env.DATABASE_PATH = path.join(temp, "database.sqlite");
Object.assign(process.env, { NODE_ENV: "test" });

async function main() {
const { setupDatabase, db } = await import("../src/db/index");
const { media, seasons, episodes } = await import("../src/db/schema");
const { organizeExistingSeries } = await import("../src/services/scanner");
const { eq } = await import("drizzle-orm");

setupDatabase();
const now = new Date().toISOString();
for (let i = 1; i <= 5; i++) {
  await db.insert(media).values({ id: `series-${i}`, type: "series",
    title: `Night Has Come E0${i}`, filePath: `/shows/Night Has Come E0${i}.mp4`,
    createdAt: `${now}-${i}`, updatedAt: now });
}
await organizeExistingSeries();
await organizeExistingSeries(); // A repeated scan must not duplicate episodes.

const titles = await db.select().from(media);
assert.equal(titles.filter((item) => !item.hiddenFromCatalog).length, 1);
assert.equal(titles.find((item) => !item.hiddenFromCatalog)?.title, "Night Has Come");
const linked = await db.select().from(episodes).where(eq(episodes.mediaId, "series-1"));
assert.deepEqual(linked.map((item) => item.episodeNumber).sort(), [1, 2, 3, 4, 5]);
const linkedSeasons = await db.select().from(seasons).where(eq(seasons.mediaId, "series-1"));
assert.equal(linkedSeasons.length, 1);
fs.rmSync(temp, { recursive: true, force: true });
console.log("Existing series reconciliation passed");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });

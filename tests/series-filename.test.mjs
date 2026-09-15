import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const file = fileURLToPath(new URL("../src/services/filename-parser.ts", import.meta.url));
const source = readFileSync(file, "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function("module", "exports", "require", compiled)(module, module.exports, () => ({}));
const { seriesIdentity } = module.exports;

for (const [fileName, title, season, episode] of [
  ["/shows/Night Has Come E01.mp4", "Night Has Come", 1, 1],
  ["/shows/Night.Has.Come.S01E05.1080p.mkv", "Night Has Come", 1, 5],
  ["/shows/Series/Season 2/Episode 3.mkv", "Series", 2, 3],
  ["/shows/Series/Season 1/EP1.mp4", "Series", 1, 1],
  ["/shows/Night Has Come Season 1 EP1.mp4", "Night Has Come", 1, 1],
  ["/shows/Night.Has.Come.(2023).S01E02.1080p.mkv", "Night Has Come", 1, 2],
]) {
  const parsed = seriesIdentity(fileName);
  assert.equal(parsed?.title, title, fileName);
  assert.equal(parsed?.season, season, fileName);
  assert.equal(parsed?.episode, episode, fileName);
}
assert.equal(seriesIdentity("/movies/The Matrix (1999).mkv"), null);
console.log("Series filename grouping passed");

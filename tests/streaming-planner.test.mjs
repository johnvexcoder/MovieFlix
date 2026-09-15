import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { createRequire } from "node:module";

const file = fileURLToPath(new URL("../src/streaming/planner.ts", import.meta.url));
const source = readFileSync(file, "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
new Function("module", "exports", "require", compiled)(module, module.exports, createRequire(import.meta.url));
const { planRenditions } = module.exports;

const full = planRenditions({ width: 1921, height: 1081, durationSeconds: 7200, hasAudio: true });
assert.deepEqual(full.map((item) => item.height), [240, 360, 480, 720, 1080]);
assert(full.every((item) => item.width % 2 === 0 && item.width <= 1921));

const hd = planRenditions({ width: 1280, height: 720, durationSeconds: 5400, hasAudio: false });
assert.deepEqual(hd.map((item) => item.height), [240, 360, 480, 720]);
assert(hd.every((item) => item.audioBitrateKbps === 0));

const sd = planRenditions({ width: 853, height: 479, durationSeconds: 100, hasAudio: true });
assert.deepEqual(sd.map((item) => item.height), [240, 360]);
assert.throws(() => planRenditions({ width: 0, height: 0, durationSeconds: 0, hasAudio: false }));
console.log("Streaming V2 rendition planner passed");

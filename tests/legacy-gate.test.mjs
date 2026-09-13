// Legacy gate unit test — runs public/legacy-gate.js inside isolated vm sandboxes
// that fake a Smart-TV engine (module-capable vs module-incapable).
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("../public/legacy-gate.js", import.meta.url)),
  "utf8"
);

function makeScriptFactory({ modern }) {
  return () => {
    const attrs = {};
    const el = { tagName: "script" };
    if (modern) el.noModule = true; // engines that support modules expose this
    el.setAttribute = (k, v) => { attrs[k] = String(v); };
    Object.defineProperty(el, "type", {
      get() {
        // Legacy engines treat an unknown `module` type as inert ('').
        if (attrs.type === "module" && !modern) return "";
        return attrs.type || "";
      },
    });
    return el;
  };
}

function runGate({ modern, hasPromise = true, pathname = "/browse/1", replaceThrows = false }) {
  const replaceCalls = [];
  const hrefCalls = [];
  const callbacks = {};

  const location = {
    pathname,
    replace(url) {
      if (replaceThrows) throw new Error("replace unavailable");
      replaceCalls.push(String(url));
    },
    get href() {
      return hrefCalls.length ? hrefCalls[hrefCalls.length - 1] : "http://localhost" + pathname;
    },
    set href(url) {
      hrefCalls.push(String(url));
    },
  };

  const window = { location, addEventListener() {}, __MVF_ENGINE_OK__: undefined };

  const sandbox = {
    document: { createElement: makeScriptFactory({ modern }) },
    window,
    setInterval: callbacks,
    clearInterval() {},
    location,
  };
  if (!hasPromise) sandbox.Promise = undefined; // shadow vm built-in

  const context = createContext(sandbox);
  runInContext(source, context);
  return {
    engineOk: window.__MVF_ENGINE_OK__,
    replaceCalls,
    hrefCalls,
  };
}

let checks = 0;
function check(name, fn) {
  checks += 1;
  fn();
  console.log("ok -", name);
}

// 1. Modern engine (noModule + Promise): stays put, marks engine OK.
{
  const r = runGate({ modern: true });
  check("modern engine marks __MVF_ENGINE_OK__=true", () => {
    assert.equal(r.engineOk, true);
    assert.equal(r.replaceCalls.length, 0);
    assert.equal(r.hrefCalls.length, 0);
  });
}

// 2. Module-capable but no Promise: treated as legacy, redirect carries ?from=.
{
  const r = runGate({ modern: true, hasPromise: false, pathname: "/browse/1" });
  check("module-capable but Promise-less engine redirects with ?from=", () => {
    assert.equal(r.engineOk, false);
    assert.equal(r.replaceCalls.length, 1);
    assert.equal(r.replaceCalls[0], "/legacy-tv.html?from=%2Fbrowse%2F1");
  });
}

// 3. Legacy engine (no noModule, no Promise): redirected; pathname is encoded.
{
  const r = runGate({ modern: false, pathname: '/movies/The 100% Off' });
  check("legacy engine redirects with encoded ?from=", () => {
    assert.equal(r.engineOk, false);
    assert.equal(r.replaceCalls.length, 1);
    assert.equal(r.replaceCalls[0], "/legacy-tv.html?from=%2Fmovies%2FThe%20100%25%20Off");
  });
}

// 4. replace() throws -> falls back to location.href assignment.
{
  const r = runGate({ modern: false, pathname: "/browse/1", replaceThrows: true });
  check("falls back to location.href when replace() is unavailable", () => {
    assert.equal(r.replaceCalls.length, 0);
    assert.equal(r.hrefCalls.length, 1);
    assert.equal(r.hrefCalls[0], "/legacy-tv.html?from=%2Fbrowse%2F1");
  });
}

// 5. Bare root path (no pathname) still redirects safely.
{
  const r = runGate({ modern: false, pathname: "/" });
  check("root path produces ?from=%2F", () => {
    assert.equal(r.replaceCalls[0], "/legacy-tv.html?from=%2F");
  });
}

console.log(`\nlegacy-gate tests passed: ${checks} assertions`);
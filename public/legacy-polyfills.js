/* Small ES5 runtime bridge for older Smart TV Chromium/WebKit engines.
 *
 * Older smart-TV browsers (Tizen 2/3, webOS 2/3, NetCast, early Android TV)
 * ship incomplete ES2015+ runtimes. Next.js/React and the bundled app assume
 * these APIs exist, and a single missing global is enough to produce a white
 * screen on an otherwise healthy device. This file must stay ES5-only so that
 * it executes on the engines it is meant to protect.
 */
/* eslint-disable @typescript-eslint/no-this-alias */
(function () {
  "use strict";

  var undef;
  function isFunc(fn) { return typeof fn === "function"; }
  function hasOwn(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }

  // ---- Object ----
  if (!isFunc(Object.assign)) {
    Object.assign = function (target) {
      if (target == null) throw new TypeError("Cannot convert undefined or null to object");
      var out = Object(target);
      for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        if (src == null) continue;
        for (var key in src) if (hasOwn(src, key)) out[key] = src[key];
      }
      return out;
    };
  }
  if (!isFunc(Object.fromEntries)) {
    Object.fromEntries = function (entries) {
      var out = {};
      if (entries == null) throw new TypeError("Object.fromEntries requires an iterable");
      for (var i = 0; i < entries.length; i++) out[entries[i][0]] = entries[i][1];
      return out;
    };
  }
  if (!isFunc(Object.entries)) {
    Object.entries = function (obj) {
      var out = [];
      for (var key in obj) if (hasOwn(obj, key)) out.push([key, obj[key]]);
      return out;
    };
  }
  if (!isFunc(Object.values)) {
    Object.values = function (obj) {
      var out = [];
      for (var key in obj) if (hasOwn(obj, key)) out.push(obj[key]);
      return out;
    };
  }

  // ---- Number ----
  if (!isFunc(Number.isNaN)) {
    Number.isNaN = function (value) { return value !== value; };
  }
  if (!isFunc(Number.isFinite)) {
    Number.isFinite = function (value) { return typeof value === "number" && isFinite(value); };
  }
  if (!isFunc(Number.isInteger)) {
    Number.isInteger = function (value) { return Number.isFinite(value) && Math.floor(value) === value; };
  }

  // ---- Array ----
  if (!isFunc(Array.from)) {
    Array.from = (function () {
      function toLength(x) {
        var len = Number(x);
        return len !== len || len <= 0 ? 0 : Math.floor(Math.min(len, 9007199254740991));
      }
      function arrayLike(obj) { return obj != null && (typeof obj === "object" || typeof obj === "function"); }
      function isArrayLike(obj) {
        var length = obj == null ? void 0 : obj.length;
        return arrayLike(obj) && (typeof length === "number" || length == null) && isFinite(length || 0);
      }
      return function (arrayLike2, mapFn, thisArg) {
        if (!arrayLike2) return [];
        var items = typeof arrayLike2.length === "number" || (arrayLike2 && arrayLike2.length != null)
          ? arrayLike2 : [arrayLike2];
        if (typeof items.length !== "number") items = [items];
        var len = toLength(items.length);
        var mapped = isFunc(mapFn);
        var out = new Array(len);
        for (var i = 0; i < len; i++) {
          var v = items[i];
          out[i] = mapped ? mapFn.call(thisArg, v, i) : v;
        }
        return out;
      };
    })();
  }
  if (!Array.isArray) {
    Array.isArray = function (arg) { return Object.prototype.toString.call(arg) === "[object Array]"; };
  }
  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (search, from) {
      var i = from >>> 0;
      for (; i < this.length; i++) if (this[i] === search) return i;
      return -1;
    };
  }
  if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (fn, thisArg) {
      for (var i = 0; i < this.length; i++) fn.call(thisArg, this[i], i, this);
    };
  }
  if (!Array.prototype.map) {
    Array.prototype.map = function (fn, thisArg) {
      var out = new Array(this.length);
      for (var i = 0; i < this.length; i++) out[i] = fn.call(thisArg, this[i], i, this);
      return out;
    };
  }
  if (!Array.prototype.filter) {
    Array.prototype.filter = function (fn, thisArg) {
      var out = [];
      for (var i = 0; i < this.length; i++) if (fn.call(thisArg, this[i], i, this)) out.push(this[i]);
      return out;
    };
  }
  if (!Array.prototype.some) {
    Array.prototype.some = function (fn, thisArg) {
      for (var i = 0; i < this.length; i++) if (fn.call(thisArg, this[i], i, this)) return true;
      return false;
    };
  }
  if (!Array.prototype.every) {
    Array.prototype.every = function (fn, thisArg) {
      for (var i = 0; i < this.length; i++) if (!fn.call(thisArg, this[i], i, this)) return false;
      return true;
    };
  }
  if (!Array.prototype.includes) {
    Array.prototype.includes = function (value, from) { return this.indexOf(value, from || 0) !== -1; };
  }
  if (!Array.prototype.find) {
    Array.prototype.find = function (fn, thisArg) {
      for (var i = 0; i < this.length; i++) if (fn.call(thisArg, this[i], i, this)) return this[i];
      return undef;
    };
  }
  if (!Array.prototype.findIndex) {
    Array.prototype.findIndex = function (fn, thisArg) {
      for (var i = 0; i < this.length; i++) if (fn.call(thisArg, this[i], i, this)) return i;
      return -1;
    };
  }
  if (!Array.prototype.flat) {
    Array.prototype.flat = function (depth) {
      var d = depth === undef || depth === Infinity ? Infinity : Math.floor(depth || 0);
      var out = [];
      function flatten(arr, current) {
        for (var i = 0; i < arr.length; i++) {
          var item = arr[i];
          if (current < d && Array.isArray(item)) flatten(item, current + 1);
          else out.push(item);
        }
      }
      flatten(this, 0);
      return out;
    };
  }
  if (!Array.prototype.fill) {
    Array.prototype.fill = function (value, start, end) {
      var len = this.length >>> 0;
      var s = start >>> 0;
      var e = end === undef ? len : end >>> 0;
      for (var i = s; i < e && i < len; i++) this[i] = value;
      return this;
    };
  }
  if (!Array.prototype.reduce) {
    Array.prototype.reduce = function (fn, initial) {
      var i = 0, acc = initial;
      if (arguments.length < 2) { acc = this[0]; i = 1; }
      for (; i < this.length; i++) acc = fn(acc, this[i], i, this);
      return acc;
    };
  }

  // ---- String ----
  if (!String.prototype.includes) {
    String.prototype.includes = function (value, from) { return this.indexOf(value, from || 0) !== -1; };
  }
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (search, pos) { return this.substr(pos || 0, search.length) === search; };
  }
  if (!String.prototype.endsWith) {
    String.prototype.endsWith = function (search, len) {
      var s = this.substring(0, len === undef ? this.length : len);
      return s.substr(s.length - search.length, search.length) === search;
    };
  }
  if (!String.prototype.padStart) {
    String.prototype.padStart = function (length, fill) {
      var text = String(this), pad = String(fill || " ");
      while (text.length < length) text = pad + text;
      return text.slice(-length);
    };
  }
  if (!String.prototype.trimStart) {
    String.prototype.trimStart = function () { return String(this).replace(/^\s+/, ""); };
    String.prototype.trimLeft = String.prototype.trimStart;
  }
  if (!String.prototype.trimEnd) {
    String.prototype.trimEnd = function () { return String(this).replace(/\s+$/, ""); };
    String.prototype.trimRight = String.prototype.trimEnd;
  }
  if (!String.prototype.repeat) {
    String.prototype.repeat = function (count) {
      var text = String(this), out = "", n = Math.max(0, count >>> 0);
      for (var i = 0; i < n; i++) out += text;
      return out;
    };
  }

  // ---- Promise ----
  if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
    Promise.prototype.finally = function (callback) {
      var P = this.constructor;
      return this.then(
        function (value) { return P.resolve(callback()).then(function () { return value; }); },
        function (reason) { return P.resolve(callback()).then(function () { throw reason; }); }
      );
    };
  }

  // ---- Element / CSSOM ----
  if (window.Element && !Element.prototype.matches) {
    Element.prototype.matches =
      Element.prototype.matchesSelector ||
      Element.prototype.webkitMatchesSelector ||
      Element.prototype.mozMatchesSelector ||
      Element.prototype.msMatchesSelector ||
      Element.prototype.oMatchesSelector ||
      function (sel) {
        var parent = this.parentNode;
        var matches = parent ? parent.querySelectorAll(sel) : null;
        if (!matches) return false;
        for (var i = 0; i < matches.length; i++) if (matches[i] === this) return true;
        return false;
      };
  }
  if (window.Element && !Element.prototype.closest) {
    Element.prototype.closest = function (sel) {
      var el = this;
      while (el && el !== document) {
        if (el.matches(sel)) return el;
        el = el.parentNode;
      }
      return null;
    };
  }
  if (window.NodeList && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }

  // ---- Event helpers ----
  if (typeof window.CustomEvent !== "function") {
    window.CustomEvent = function (type, params) {
      params = params || { bubbles: false, cancelable: false, detail: undef };
      var evt = document.createEvent("CustomEvent");
      evt.initCustomEvent(type, !!params.bubbles, !!params.cancelable, params.detail);
      return evt;
    };
    window.CustomEvent.prototype = window.Event.prototype;
  }
  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = (function () {
      var last = 0;
      return function (cb) {
        var now = new Date().getTime();
        var next = Math.max(0, 16 - (now - last));
        var id = window.setTimeout(function () { cb(now + next); }, next);
        last = now + next;
        return id;
      };
    })();
    window.cancelAnimationFrame = function (id) { window.clearTimeout(id); };
  }

  // ---- matchMedia ----
  // Older TV engines shipped a missing or always-false matchMedia. Implement a
  // real evaluator for the width/height/orientation queries Tailwind and the
  // app rely on so responsive layouts work instead of silently collapsing.
  if (typeof window.matchMedia !== "function") {
    (function () {
      function parse(value) {
        var m = /^(?:\(\s*)(min-width|max-width|min-height|max-height|orientation)\s*:\s*([^)]+)\s*\)$/.exec(value || "");
        return m ? { feature: m[1], value: m[2] } : null;
      }
      function matchesQuery(query) {
        var q = String(query).trim();
        if (q === "all" || q === "") return true;
        var orParts = q.split(",");
        for (var i = 0; i < orParts.length; i++) {
          var andParts = orParts[i].trim().split("and");
          var ok = true;
          for (var j = 0; j < andParts.length; j++) {
            var parsed = parse(andParts[j].trim());
            if (!parsed) continue;
            if (parsed.feature === "orientation") {
              var landscape = window.innerWidth >= window.innerHeight;
              var wantLandscape = parsed.value === "landscape";
              if (landscape !== wantLandscape) { ok = false; break; }
            } else {
              var num = parseFloat(parsed.value);
              var actual = parsed.feature.indexOf("height") !== -1 ? window.innerHeight : window.innerWidth;
              if (parsed.feature.indexOf("min") === 0 && actual < num) { ok = false; break; }
              if (parsed.feature.indexOf("max") === 0 && actual > num) { ok = false; break; }
            }
          }
          if (ok) return true;
        }
        return false;
      }
      window.matchMedia = function (query) {
        var current = matchesQuery(query);
        var listenerMap = {};
        return {
          matches: current,
          media: query,
          addListener: function (fn) {},
          removeListener: function (fn) {},
          addEventListener: function (type, fn) { listenerMap[type] = fn; },
          removeEventListener: function (type, fn) { if (listenerMap[type] === fn) delete listenerMap[type]; },
          dispatchEvent: function () { return false; },
        };
      };
    })();
  }

  // ---- crypto.randomUUID ----
  if (window.crypto && !window.crypto.randomUUID) {
    try {
      window.crypto.randomUUID = function () {
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        var hex = [];
        for (var i = 0; i < bytes.length; i++) hex.push((bytes[i] + 256).toString(16).slice(1));
        return hex[0] + hex[1] + hex[2] + hex[3] + "-" + hex[4] + hex[5] + "-" +
          hex[6] + hex[7] + "-" + hex[8] + hex[9] + "-" + hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15];
      };
    } catch (e) { /* keep native behaviour on failure */ }
  }
})();
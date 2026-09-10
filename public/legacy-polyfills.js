/* Small ES5 runtime bridge for older Smart TV Chromium/WebKit engines. */
(function () {
  if (typeof Object.assign !== "function") Object.assign = function (target) { if (target == null) throw new TypeError(); var out = Object(target); for (var i = 1; i < arguments.length; i++) { var src = arguments[i]; if (src != null) for (var key in src) if (Object.prototype.hasOwnProperty.call(src, key)) out[key] = src[key]; } return out; };
  if (!Array.prototype.includes) Array.prototype.includes = function (value, from) { return this.indexOf(value, from || 0) !== -1; };
  if (!String.prototype.includes) String.prototype.includes = function (value, from) { return this.indexOf(value, from || 0) !== -1; };
  if (!String.prototype.padStart) String.prototype.padStart = function (length, fill) { var text = String(this), pad = String(fill || " "); while (text.length < length) text = pad + text; return text.slice(-length); };
  if (typeof Object.fromEntries !== "function") Object.fromEntries = function (entries) { var out = {}; for (var i = 0; i < entries.length; i++) out[entries[i][0]] = entries[i][1]; return out; };
  if (typeof Promise !== "undefined" && !Promise.prototype.finally) Promise.prototype.finally = function (callback) { var P = this.constructor; return this.then(function (value) { return P.resolve(callback()).then(function () { return value; }); }, function (reason) { return P.resolve(callback()).then(function () { throw reason; }); }); };
  if (typeof window.matchMedia !== "function") window.matchMedia = function () { return { matches: false, media: "", addListener: function () {}, removeListener: function () {} }; };
  if (window.crypto && !window.crypto.randomUUID) window.crypto.randomUUID = function () { var bytes = new Uint8Array(16); window.crypto.getRandomValues(bytes); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128; var hex = []; for (var i = 0; i < bytes.length; i++) hex.push((bytes[i] + 256).toString(16).slice(1)); return hex[0]+hex[1]+hex[2]+hex[3]+"-"+hex[4]+hex[5]+"-"+hex[6]+hex[7]+"-"+hex[8]+hex[9]+"-"+hex[10]+hex[11]+hex[12]+hex[13]+hex[14]+hex[15]; };
})();

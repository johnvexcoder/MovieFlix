/**
 * legacy-gate.js - ES5 engine-capability gate (classic script, no deps).
 *
 * Runs in <head> BEFORE the application polyfills and bundle. Modern Next.js
 * emits ES-module scripts; a Smart TV engine that cannot parse them would
 * silently ignore the whole app and leave a blank screen. This gate detects
 * that condition and hands off to the standalone ES5 portal
 * (/legacy-tv.html) which only needs classic scripts.
 *
 * Safe everywhere: it is plain ES5 and never throws.
 */
(function () {

  /* Detect whether the engine understands <script type="module">. */
  function supportsModules() {
    try {
      var el = document.createElement('script');
      // Chromium 61+, Safari 10.1+, Firefox 60+ expose `noModule`.
      if ('noModule' in el) return true;
      // Older fallback: engines that support modules keep the assigned type.
      el.setAttribute('type', 'module');
      return el.type === 'module';
    } catch (e) {
      return false;
    }
  }

  function supportsPromise() {
    try {
      return typeof Promise === 'function';
    } catch (e) {
      return false;
    }
  }

  /* Some engines (e.g. Chromium 61-79 browsers on old TVs) report that they
   * support ES modules but still cannot parse the modern operators the Next.js
   * dev bundle relies on (optional chaining `?.`, nullish `??`). If we cannot
   * compile those, hydration dies after the splash and the user gets stuck on
   * the boot-diagnostics wall. Probe the actual grammar instead of trusting
   * the module flag alone. If eval is blocked (CSP) we cannot verify, so we
   * optimistically assume the engine is fine and let the app try. */
  function parsesModernGrammar() {
    function compiles(body) {
      try {
        var F = new Function(body);
        F();
        return true;
      } catch (e) {
        return false;
      }
    }
    try {
      if (typeof Array.from !== 'function') return false;
      if (typeof Object.assign !== 'function') return false;
      if (typeof Symbol !== 'function') return false;
      return compiles('var o = { a: [1] }; return o.a?.[0] != null ? (o.missing ?? "x") : "y";');
    } catch (e) {
      return true; // can't run probes (restricted eval) — assume modern
    }
  }

  // Determine if the device is likely a TV based on user agent
   function isLikelyTV() {
     var ua = String(window.navigator.userAgent || '');
     var tvPatterns = [
       /SmartTV/i,
       /\bTV\b/i,
       / Roku/i,
       /HbbTV/i,
       /Netcast/i,
       /Viera/i,
       /WebOS/i,
       /Tizen/i,
       /WebKit.*TV/i,
       /CrKey/i,
     ];
     for (var i = 0; i < tvPatterns.length; i++) {
       if (tvPatterns[i].test(ua)) {
         return true;
       }
     }
     return false;
   }

   var ok = supportsModules() && supportsPromise() && parsesModernGrammar();
   if (!isLikelyTV()) {
     // For non-TV devices, assume modern to avoid false positives on desktop browsers.
     ok = true;
   }

  try {
    window.__MVF_ENGINE_OK__ = ok;
  } catch (e) { /* ignore */ }

  if (!ok) {
    try {
      var dest = '/legacy-tv.html';
      try {
        var here = String(window.location.pathname || '/');
        dest = dest + '?from=' + encodeURIComponent(here);
      } catch (e) { /* keep bare dest */ }
      // location.replace prevents the broken page from entering the back
      // history. If replace is missing or throws, fall back to href.
      if (window.location && window.location.replace) {
        try {
          window.location.replace(dest);
        } catch (e) {
          window.location.href = dest;
        }
      } else if (window.location) {
        window.location.href = dest;
      }
    } catch (e) { /* ignore: worst case the white-screen sentinel shows */ }
  }
})();
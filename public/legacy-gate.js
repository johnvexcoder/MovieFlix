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

  var ok = supportsModules() && supportsPromise();

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
/* theme.js — the light/dark toggle between the site's two registers.
 * Light is the Six Liquors catalogue; dark is the Night Kiln session.
 * Choice persists in localStorage('hd-tea-theme'); the pre-paint script
 * in the layout <head> applies it before first render. */
(function () {
  'use strict';
  var KEY = 'hd-tea-theme';
  var root = document.documentElement;

  function current() {
    var explicit = root.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }

  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(KEY, next); } catch (e) { /* private mode */ }
    });
  });
})();

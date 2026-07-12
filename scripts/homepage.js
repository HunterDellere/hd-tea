/* homepage.js — renders the flight, recent entries, and search from
 * data/entries.json + data/search-index.json. Also registers the
 * service worker for the PWA shell. */
(function () {
  'use strict';

  var TYPES = [
    { key: 'green',  native: '绿', label: 'Green' },
    { key: 'white',  native: '白', label: 'White' },
    { key: 'yellow', native: '黄', label: 'Yellow' },
    { key: 'oolong', native: '青', label: 'Oolong' },
    { key: 'black',  native: '红', label: 'Black' },
    { key: 'dark',   native: '黑', label: 'Dark' },
    { key: 'tisane', native: '草', label: 'Tisanes' }
  ];

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function cupStyleFor(key) {
    return '--cup-hi:var(--lq-' + key + '-hi);--cup-mid:var(--lq-' + key + ');--cup-deep:var(--lq-' + key + '-deep)';
  }

  function entryRow(e) {
    var marker = e.liquor
      ? '<span class="cup" style="--cup-hi:' + shade(e.liquor, 0.5, '#fff8e8') + ';--cup-mid:' + e.liquor + ';--cup-deep:' + shade(e.liquor, 0.38, '#1a0e06') + '" aria-hidden="true"></span>'
      : '<span class="er-dot" style="--dot-c:var(--cat-' + esc(e.category) + ')" aria-hidden="true"></span>';
    var native = e.native ? ' <span class="native">' + esc(e.native) + '</span>' : '';
    return '<a class="entry-row" href="' + esc(e.path) + '">' + marker +
      '<span class="er-body"><span class="er-title">' + esc(e.title) + native + '</span>' +
      '<span class="er-desc">' + esc(e.desc) + '</span></span>' +
      '<span class="er-meta">' + esc(e.category) + '</span></a>';
  }

  /* tiny hex mixer mirroring build/lib/liquor.mjs */
  function shade(hex, t, toward) {
    function rgb(h) {
      var n = parseInt(h.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    var a = rgb(hex);
    var b = rgb(toward);
    var out = a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); });
    return '#' + out.map(function (v) { return v.toString(16).padStart(2, '0'); }).join('');
  }

  fetch('data/entries.json')
    .then(function (r) {
      if (!r.ok) throw new Error('entries.json ' + r.status);
      return r.json();
    })
    .then(function (entries) {
      // Flight
      var flight = document.getElementById('flight');
      if (flight) {
        flight.innerHTML = TYPES.map(function (t) {
          var n = entries.filter(function (e) { return e.tea_type === t.key; }).length;
          return '<a href="pages/hubs/library.html#' + (t.key === 'tisane' ? 'tisanes' : 'teas') + '">' +
            '<span class="cup" style="' + cupStyleFor(t.key) + '" aria-hidden="true"></span>' +
            '<span class="flight-native">' + t.native + '</span>' +
            '<span class="flight-en">' + t.label + '</span>' +
            '<span class="flight-n">' + n + (n === 1 ? ' entry' : ' entries') + '</span></a>';
        }).join('');
      }

      // Recent (complete entries by updated date)
      var recent = document.getElementById('recent');
      if (recent) {
        var rows = entries
          .filter(function (e) { return e.status === 'complete' && e.updated; })
          .sort(function (a, b) { return b.updated.localeCompare(a.updated); })
          .slice(0, 6);
        recent.innerHTML = rows.length
          ? rows.map(entryRow).join('')
          : '<p class="er-desc">Entries land here as they are authored.</p>';
      }

      // Search
      var input = document.getElementById('q');
      var out = document.getElementById('search-results');
      if (input && out) {
        var index = null;
        fetch('data/search-index.json')
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (idx) { index = idx; });
        input.addEventListener('input', function () {
          var q = input.value.trim().toLowerCase();
          if (q.length < 2 || !index) { out.innerHTML = ''; return; }
          var hits = {};
          Object.keys(index.tokens).forEach(function (tok) {
            if (tok.indexOf(q) === 0 || (q.length >= 3 && tok.indexOf(q) !== -1)) {
              index.tokens[tok].forEach(function (i) { hits[i] = (hits[i] || 0) + 1; });
            }
          });
          var ranked = Object.keys(hits)
            .sort(function (a, b) { return hits[b] - hits[a]; })
            .slice(0, 8)
            .map(function (i) { return entries[Number(i)]; })
            .filter(Boolean);
          out.innerHTML = ranked.length
            ? ranked.map(entryRow).join('')
            : '<p class="er-desc">Nothing in the atlas matches "' + esc(q) + '" yet.</p>';
        });
      }
    })
    .catch(function () {
      var flight = document.getElementById('flight');
      if (flight) flight.innerHTML = '<p class="er-desc">Run npm run build to generate site data.</p>';
    });

  // PWA shell
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* offline support is progressive */ });
  }
})();

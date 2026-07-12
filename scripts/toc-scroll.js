/* toc-scroll.js — TOC scroll-spy + mobile sidebar toggle.
 * Included at the end of <body> on every content page. */
(function () {
  'use strict';

  // Scroll-spy: highlight the TOC link whose section is in view.
  var anchors = Array.prototype.slice.call(document.querySelectorAll('.section-anchor'));
  var links = Array.prototype.slice.call(document.querySelectorAll('.toc-list a'));
  if (anchors.length && links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) {
      var id = (a.getAttribute('href') || '').replace('#', '');
      if (id) byId[id] = a;
    });
    var observer = new IntersectionObserver(function (entriesList) {
      entriesList.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove('active'); });
        var link = byId[entry.target.id];
        if (link) link.classList.add('active');
      });
    }, { rootMargin: '-10% 0px -75% 0px' });
    anchors.forEach(function (a) { observer.observe(a); });
  }

  // Mobile sidebar toggle
  var toggle = document.querySelector('.toc-toggle');
  var sidebar = document.getElementById('sidebar');
  if (toggle && sidebar) {
    toggle.addEventListener('click', function () {
      var open = sidebar.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Contents ▴' : 'Contents ▾';
    });
    sidebar.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        sidebar.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Contents ▾';
      }
    });
  }
})();

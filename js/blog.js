(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Reveal on scroll (reuses .reveal styles from styles.css) --- */
  if (!reducedMotion) {
    var singles = document.querySelectorAll('.featured-card, .index-toolbar, .post-more-h, .closing .centered');
    singles.forEach(function (el) { el.classList.add('reveal'); });
    document.querySelectorAll('.index-list').forEach(function (list) {
      Array.prototype.forEach.call(list.children, function (row, i) {
        row.classList.add('reveal');
        row.style.setProperty('--reveal-delay', Math.min(i * 60, 360) + 'ms');
      });
    });
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    document.querySelectorAll('.reveal').forEach(function (el) { revealObserver.observe(el); });
  }

  /* --- Category filter --- */
  var chips = document.querySelectorAll('.filter-chip');
  var rows = document.querySelectorAll('.index-list .index-row[data-category]');
  var empty = document.querySelector('.index-empty');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      chips.forEach(function (c) { c.classList.remove('is-active'); });
      chip.classList.add('is-active');
      var filter = chip.dataset.filter;
      var visible = 0;
      rows.forEach(function (row) {
        var show = filter === 'all' || row.dataset.category === filter;
        row.hidden = !show;
        if (show) visible++;
      });
      if (empty) empty.hidden = visible > 0;
    });
  });

  /* --- Mobile menu: close after choosing a link --- */
  var mobileMenu = document.querySelector('.mobile-menu');
  if (mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { mobileMenu.removeAttribute('open'); });
    });
  }
})();

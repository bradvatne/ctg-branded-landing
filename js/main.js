(function () {
  'use strict';

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- Hero video: fetch after page load, play only while on screen --- */
  var video = document.querySelector('.hero-device video');
  if (video) {
    var loadVideo = function () {
      if (!video.src) {
        video.src = video.dataset.src;
        video.load();
      }
    };
    if (document.readyState === 'complete') {
      loadVideo();
    } else {
      window.addEventListener('load', loadVideo, { once: true });
    }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          loadVideo();
          video.play().catch(function () {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.2 }).observe(video);
  }

  /* --- Nav: solid background once the page is scrolled --- */
  var navWrap = document.querySelector('.nav-wrap');
  if (navWrap) {
    var onScroll = function () {
      navWrap.classList.toggle('scrolled', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* --- Reveal on scroll, staggered inside card grids --- */
  if (!reducedMotion) {
    var singles = document.querySelectorAll(
      '.section-heading, .feature-copy, .feature-row .placeholder, .trust .small-label, .client-row, blockquote, .quote-meta, .closing .centered, .pricing > div:first-child'
    );
    var groups = document.querySelectorAll(
      '.proof-grid, .platform-grid, .lever-grid, .phones, .timeline, .faq-list, .pricing'
    );
    singles.forEach(function (el) { el.classList.add('reveal'); });
    groups.forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child, i) {
        child.classList.add('reveal');
        child.style.setProperty('--reveal-delay', Math.min(i * 90, 450) + 'ms');
      });
    });

    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(function (el) { revealObserver.observe(el); });
  }

  /* --- Proof stats: count up when they scroll into view --- */
  var stats = document.querySelectorAll('[data-count]');
  if (stats.length && !reducedMotion && 'IntersectionObserver' in window) {
    var animateCount = function (el) {
      var target = parseInt(el.dataset.count, 10);
      var prefix = el.dataset.prefix || '';
      var suffix = el.dataset.suffix || '';
      var duration = 1100;
      var start = null;
      var step = function (ts) {
        if (start === null) start = ts;
        var progress = Math.min((ts - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = prefix + Math.round(target * eased) + suffix;
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    var statObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          statObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    stats.forEach(function (el) { statObserver.observe(el); });
  }

  /* --- Mobile menu: close after choosing a link --- */
  var mobileMenu = document.querySelector('.mobile-menu');
  if (mobileMenu) {
    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { mobileMenu.removeAttribute('open'); });
    });
  }
})();

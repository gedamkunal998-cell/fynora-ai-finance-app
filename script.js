/* Fynora website interactions */
(function () {
  'use strict';

  // ---- Loader ----
  window.addEventListener('load', function () {
    var l = document.getElementById('loader');
    if (l) setTimeout(function () { l.classList.add('hidden'); setTimeout(function () { l.remove(); }, 500); }, 300);
  });

  // ---- Sticky header ----
  var header = document.getElementById('header');
  function onScroll() {
    if (!header) return;
    if (window.scrollY > 12) header.classList.add('scrolled'); else header.classList.remove('scrolled');
    var btt = document.getElementById('toTop');
    if (btt) { if (window.scrollY > 500) btt.classList.add('show'); else btt.classList.remove('show'); }
  }
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- Mobile menu ----
  var burger = document.getElementById('burger');
  var navLinks = document.getElementById('navLinks');
  if (burger && navLinks) {
    burger.addEventListener('click', function () { navLinks.classList.toggle('open'); });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { navLinks.classList.remove('open'); });
    });
  }

  // ---- Smooth anchor scroll (with header offset) ----
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      var y = el.getBoundingClientRect().top + window.scrollY - 60;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });

  // ---- Back to top ----
  var btt = document.getElementById('toTop');
  if (btt) btt.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  // ---- Reveal on scroll ----
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  // ---- Animated counters ----
  function animateCounter(el) {
    var target = parseFloat(el.getAttribute('data-count') || '0');
    var suffix = el.getAttribute('data-suffix') || '';
    var prefix = el.getAttribute('data-prefix') || '';
    var duration = 1600;
    var start = performance.now();
    function frame(now) {
      var p = Math.min(1, (now - start) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      var v = target * eased;
      var display;
      if (target >= 1000) display = Math.round(v).toLocaleString('en-IN');
      else if (Number.isInteger(target)) display = Math.round(v).toString();
      else display = v.toFixed(1);
      el.textContent = prefix + display + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var counterEls = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window) {
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { animateCounter(en.target); co.unobserve(en.target); }
      });
    }, { threshold: 0.4 });
    counterEls.forEach(function (el) { co.observe(el); });
  } else {
    counterEls.forEach(animateCounter);
  }

  // ---- FAQ accordion ----
  document.querySelectorAll('.faq-item').forEach(function (item) {
    var q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', function () { item.classList.toggle('open'); });
  });

  // ---- Contact form ----
  var form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var name = (data.get('name') || '').toString().trim();
      var email = (data.get('email') || '').toString().trim();
      var msg = (data.get('message') || '').toString().trim();
      if (!name || !email || !msg) return;
      var subject = encodeURIComponent('Fynora — Enquiry from ' + name);
      var body = encodeURIComponent(msg + '\n\n— ' + name + '\n' + email);
      window.location.href = 'mailto:fynorasupport@gmail.com?subject=' + subject + '&body=' + body;
      var out = document.getElementById('formMsg');
      if (out) { out.textContent = 'Opening your email client… you can also write directly to fynorasupport@gmail.com'; out.classList.add('success'); }
      form.reset();
    });
  }

  // ---- Current year ----
  var yr = document.getElementById('yr');
  if (yr) yr.textContent = new Date().getFullYear();
})();

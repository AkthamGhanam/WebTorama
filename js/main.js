/* Interacciones de la página: progreso del scroll, revelados, contadores,
   recorrido horizontal de servicios, marquesina de clientes y menú. */
(function () {
  'use strict';

  var Scene = window.Scene || { target: 0, p: 0, mouse: { x: 0, y: 0 }, reduced: true };
  var reduced = Scene.reduced;
  var root = document.documentElement;
  if (reduced) root.classList.add('rm');

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function $(s) { return document.querySelector(s); }

  var stage = $('.stage'), hero = $('#hero'), arrive = $('#arrive'), flash = $('.flash');
  var bar = $('#progress'), header = $('#top');
  var services = $('.services'), pin = $('.services__pin'), track = $('#track');
  var horizontal = false;

  // ---- Progreso de la escena de entrada ---------------------------------
  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    var len = stage.offsetHeight - window.innerHeight;
    Scene.target = reduced ? 0 : clamp(y / Math.max(len, 1), 0, 1);
    header.classList.toggle('is-solid', y > len - 10);
    document.body.classList.toggle('inside', y > len + window.innerHeight * 0.25);

    if (horizontal) {
      var r = services.getBoundingClientRect();
      var total = services.offsetHeight - window.innerHeight;
      var sp = clamp(-r.top / Math.max(total, 1), 0, 1);
      var max = track.scrollWidth - window.innerWidth;
      track.style.transform = 'translate3d(' + (-sp * max).toFixed(1) + 'px,0,0)';
    }
  }

  Scene.onFrame = function (p) {
    var h = 1 - smooth(0.012, 0.085, p);
    hero.style.opacity = h.toFixed(3);
    hero.style.visibility = h < 0.01 ? 'hidden' : 'visible';
    hero.style.transform = 'translate3d(0,' + (-p * 260).toFixed(1) + 'px,0)';

    var a = smooth(0.69, 0.83, p);
    arrive.style.opacity = a.toFixed(3);
    arrive.style.transform = 'scale(' + (0.35 + 0.65 * a).toFixed(3) + ')';
    arrive.style.visibility = a < 0.01 ? 'hidden' : 'visible';

    var f = Math.exp(-Math.pow((p - 0.7) / 0.04, 2)) * 0.8;
    flash.style.opacity = f < 0.005 ? '0' : f.toFixed(3);
    bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  };

  // ---- Servicios: scroll vertical que mueve la galería en horizontal -----
  function layoutServices() {
    horizontal = !reduced && window.innerWidth >= 900 && window.innerHeight >= 560;
    services.classList.toggle('is-horizontal', horizontal);
    if (horizontal) {
      var extra = track.scrollWidth - window.innerWidth;
      services.style.height = (window.innerHeight + Math.max(extra, 0)) + 'px';
    } else {
      services.style.height = '';
      track.style.transform = '';
    }
  }

  // ---- Revelados y contadores -------------------------------------------
  function fmt(v, dec) {
    return v.toLocaleString('es-VE', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function count(el) {
    var end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || '0', 10);
    var pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
    if (reduced) return;
    var t0 = performance.now(), dur = 1600;
    (function tick(now) {
      var t = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - t, 4);
      el.textContent = pre + fmt(end * e, dec) + suf;
      if (t < 1) requestAnimationFrame(tick);
    })(t0);
  }

  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      var b = en.target.querySelector('[data-count]');
      if (b) count(b);
      io.unobserve(en.target);
    });
  }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' }) : null;

  document.querySelectorAll('.reveal').forEach(function (el, i) {
    el.style.transitionDelay = (i % 4) * 70 + 'ms';
    if (io) io.observe(el); else el.classList.add('is-in');
  });

  // ---- Marquesina de clientes -------------------------------------------
  var CLIENTS = [
    ['cliente-01', 'Marca aliada de Torama'], ['break-empresarial', 'Break Empresarial'],
    ['acero-cristal', 'Acero Cristal'], ['jd', 'Diseños JD'], ['icor', 'ICOR'],
    ['cliente-06', 'Marca aliada de Torama'], ['trigus-bakery', "Trigu's Bakery"],
    ['lux-spa', 'Lux Spa'], ['psicomooc', 'Psicomooc'], ['contygo', 'Viajes Contygo'],
    ['hotel-manantial', 'Hotel Manantial Valencia']
  ];
  function fillRow(id, list) {
    var row = document.getElementById(id);
    if (!row) return;
    var html = '';
    for (var rep = 0; rep < 2; rep++) {
      list.forEach(function (c) {
        html += '<span class="logo"' + (rep ? ' aria-hidden="true"' : '') + '><img src="assets/clientes/' + c[0] + '.webp" alt="' + (rep ? '' : c[1]) + '" loading="lazy"></span>';
      });
    }
    row.innerHTML = html;
  }
  fillRow('logos-a', CLIENTS.slice(0, 7).concat(CLIENTS.slice(7)));
  fillRow('logos-b', CLIENTS.slice(5).concat(CLIENTS.slice(0, 5)));

  // ---- Menú móvil --------------------------------------------------------
  var burger = $('#burger'), nav = $('#nav');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    burger.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }
  burger.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
  nav.addEventListener('click', function (e) { if (e.target.tagName === 'A') setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // ---- Puntero: paralaje de la escena e inclinación de la foto ----------
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    Scene.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    Scene.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  document.querySelectorAll('.tilt').forEach(function (el) {
    if (reduced) return;
    el.addEventListener('pointermove', function (e) {
      var r = el.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--rx', (-y * 9).toFixed(2) + 'deg');
      el.style.setProperty('--ry', (x * 11).toFixed(2) + 'deg');
    });
    el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { layoutServices(); onScroll(); });
  window.addEventListener('load', function () { layoutServices(); onScroll(); });
  layoutServices();
  onScroll();
})();

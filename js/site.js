/* Estructura común de las páginas interiores (casos, noticiero): cabecera,
   menú, pie y pequeños efectos. La portada tiene la suya propia en index.html. */
(function () {
  'use strict';

  var T = (window.Torama = window.Torama || {});
  var page = document.body.getAttribute('data-page') || '';
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) document.documentElement.classList.add('rm');

  var LINKS = [
    ['index.html#nosotros', 'Quiénes somos', ''],
    ['casos.html', 'Casos de éxito', 'casos'],
    ['index.html#servicios', 'Servicios', ''],
    ['noticias.html', 'Blog', 'noticias']
  ];

  var defs = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<g id="torama-mark" data-torii="mark"></g>' +
    '<g id="torama-gate" data-torii="gate"></g></defs></svg>';

  var mark = '<svg class="brand__mark" viewBox="-112 -112 224 224" aria-hidden="true"><use href="#torama-mark"/></svg>';
  var gate = '<svg viewBox="-112 -90 224 180" aria-hidden="true"><use href="#torama-gate"/></svg>';

  var header = '<header class="top is-dock" id="top">' +
    '<a class="brand" href="index.html" aria-label="Torama Agency, inicio">' + mark + '<span class="brand__name">Torama <b>Agency</b></span></a>' +
    '<nav class="nav" id="nav" aria-label="Principal"><span class="nav__pill" aria-hidden="true"></span>' +
    LINKS.map(function (l) { return '<a href="' + l[0] + '"' + (l[2] && l[2] === page ? ' class="is-active" aria-current="page"' : '') + '>' + l[1] + '</a>'; }).join('') +
    '</nav>' +
    '<a class="top__cta" href="index.html#contacto"><span>Hablemos</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6"/></svg></a>' +
    '<button class="burger" id="burger" aria-label="Abrir menú" aria-expanded="false" aria-controls="menu"><span></span><span></span></button>' +
    '</header>' +
    '<div class="menu" id="menu" aria-hidden="true">' +
    '<svg class="menu__gate" viewBox="-112 -112 224 224" aria-hidden="true"><use href="#torama-mark"/></svg>' +
    '<nav aria-label="Menú"><a href="index.html"><i>00</i>Inicio</a><a href="index.html#nosotros"><i>01</i>Quiénes somos</a><a href="casos.html"><i>02</i>Casos de éxito</a>' +
    '<a href="index.html#servicios"><i>03</i>Servicios</a><a href="noticias.html"><i>04</i>Blog</a><a href="index.html#contacto"><i>05</i>Contacto</a></nav>' +
    '<p class="menu__foot"><a href="https://wa.me/13106906822" target="_blank" rel="noopener">WhatsApp</a><a href="https://www.instagram.com/toramaagency" target="_blank" rel="noopener">Instagram</a><a href="mailto:Toramaagency@gmail.com">Correo</a></p></div>';

  var footer = '<footer class="foot" id="pie">' +
    '<div class="foot__scene" aria-hidden="true"><div class="foot__sun"></div>' +
    '<svg class="foot__mount" viewBox="0 0 1440 200" preserveAspectRatio="none"><path class="m1" d="M0 200 V120 L90 96 L180 126 L300 70 L400 118 L520 88 L620 140 L720 176 L820 138 L930 84 L1010 30 L1090 84 L1200 110 L1310 76 L1440 116 V200 Z"/><path class="m2" d="M0 200 V160 L120 132 L260 162 L380 128 L520 166 L720 190 L900 160 L1040 126 L1180 160 L1320 134 L1440 158 V200 Z"/></svg>' +
    '<svg class="foot__gate" viewBox="-112 -90 224 180"><use href="#torama-gate"/></svg></div>' +
    '<div class="foot__water"><div class="foot__shine" aria-hidden="true"></div><svg class="foot__mirror" viewBox="-112 -90 224 180" aria-hidden="true"><use href="#torama-gate"/></svg>' +
    '<div class="wrap"><p class="foot__lead">Estamos para <em>crecer juntos</em></p><div class="foot__grid">' +
    '<div class="foot__brand"><a class="brand" href="index.html" aria-label="Volver al inicio">' + mark + '<span class="brand__name">Torama <b>Agency</b></span></a>' +
    '<p>Agencia de comunicación y publicidad digital. Marketing de resultados para marcas en Venezuela y el mundo.</p>' +
    '<ul class="social">' +
    '<li><a href="https://www.instagram.com/toramaagency" target="_blank" rel="noopener" aria-label="Instagram @toramaagency"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.3" cy="6.7" r=".6"/></svg></a></li>' +
    '<li><a href="https://www.facebook.com/Toramaagency" target="_blank" rel="noopener" aria-label="Facebook Torama Agency"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 21v-8h3l.5-3.5H14V7.6c0-1 .4-1.6 1.7-1.600h1.800V3.100C17 3 16 3 15 3c-2.6 0-4.2 1.6-4.2 4.300v2.200H8V13h2.800v8"/></svg></a></li>' +
    '<li><a href="https://wa.me/13106906822" target="_blank" rel="noopener" aria-label="WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4.300A8 8 0 1 1 8.6 19L4 20z"/></svg></a></li>' +
    '<li><a href="mailto:Toramaagency@gmail.com" aria-label="Correo electrónico"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7.500l8 6 8-6"/></svg></a></li></ul></div>' +
    '<nav class="foot__col" aria-label="Explora"><h3>Explora</h3><a href="index.html">Inicio</a><a href="index.html#nosotros">Quiénes somos</a><a href="casos.html">Casos de éxito</a><a href="index.html#servicios">Servicios</a><a href="noticias.html">Blog</a></nav>' +
    '<div class="foot__col"><h3>Servicios</h3><a href="index.html#servicios">Meta Ads</a><a href="index.html#servicios">Producción audiovisual</a><a href="index.html#servicios">Creación de contenido</a><a href="index.html#servicios">Contenido con IA</a><a href="index.html#servicios">Fotografía y diseño gráfico</a><a href="index.html#servicios">Auditoría y formaciones</a></div>' +
    '<div class="foot__col"><h3>Contacto</h3><a href="https://wa.me/13106906822" target="_blank" rel="noopener">+1 (310) 690-6822</a><a href="mailto:Toramaagency@gmail.com">Toramaagency@gmail.com</a><p>Lunes a viernes · 9:00 am a 5:00 pm</p><p>Valencia, Venezuela<br>San Diego, Urb. La Esmeralda</p><p class="foot__remote">Llegamos a donde tú nos llames</p></div>' +
    '</div></div>' +
    '<p class="foot__word" aria-hidden="true"><span>T</span><span>O</span><span>R</span><span>A</span><span>M</span><span>A</span></p>' +
    '<div class="wrap foot__bar"><p>© <span id="year"></span> Torama Agency · Valencia, Venezuela · <a href="privacidad.html">Política de privacidad</a> · <a href="admin.html">Panel del equipo</a></p>' +
    '<a class="totop" href="#top">Volver arriba' + gate + '</a></div></div></footer>';

  function mount(sel, html, where) {
    var el = document.querySelector(sel);
    if (el) el.outerHTML = html; else document.body.insertAdjacentHTML(where, html);
  }
  document.body.insertAdjacentHTML('afterbegin', defs);
  mount('[data-chrome="header"]', header, 'afterbegin');
  mount('[data-chrome="footer"]', footer, 'beforeend');
  if (window.TORII) window.TORII.paint();
  document.getElementById('year').textContent = String(new Date().getFullYear());

  // ---- Menú ---------------------------------------------------------------
  var top = document.getElementById('top'), burger = document.getElementById('burger'), menu = document.getElementById('menu');
  var nav = document.getElementById('nav'), foot = document.querySelector('.foot'), glow = document.getElementById('glow');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (open) top.classList.remove('is-hidden');
  }
  burger.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  function pill() {
    var a = nav.querySelector('a.is-active');
    if (!a) return;
    nav.style.setProperty('--px', a.offsetLeft + 'px');
    nav.style.setProperty('--pw', a.offsetWidth + 'px');
    nav.style.setProperty('--po', '1');
  }

  // ---- Scroll: cabecera, amanecer de fondo y sol del pie -------------------
  var lastY = 0, ticking = false;
  function update() {
    ticking = false;
    var y = window.scrollY || 0, vh = window.innerHeight;
    if (!document.body.classList.contains('menu-open') && Math.abs(y - lastY) > 6) top.classList.toggle('is-hidden', y > lastY && y > 300);
    lastY = y;
    var end = document.documentElement.scrollHeight - vh;
    if (window.Scene) {
      window.Scene.dayTarget = Math.pow(Math.min(Math.max(y / Math.max(end, 1), 0), 1), 2) * 0.9;
      if (reduced && window.Scene.render) window.Scene.render();
    }
    var fr = foot.getBoundingClientRect();
    if (fr.top < vh) foot.style.setProperty('--rise', Math.min(Math.max((vh - fr.top) / (vh * 0.9), 0), 1).toFixed(3));
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', function () { pill(); update(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(pill);
  pill(); update();

  // ---- Revelados (también para contenido que se añade después) -------------
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
  }, { threshold: 0.02, rootMargin: '0px 0px -5% 0px' }) : null;
  T.revelar = function (root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('.reveal:not(.is-in)'), function (el, i) {
      el.style.setProperty('--rd', Math.min(i % 6, 5) * 70 + 'ms');
      if (io) io.observe(el); else el.classList.add('is-in');
    });
  };
  T.revelar();

  // ---- Puntero ---------------------------------------------------------------
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches && !reduced) {
    document.documentElement.classList.add('has-pointer');
    var gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy;
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      if (window.Scene) { window.Scene.mouse.x = (tx / innerWidth) * 2 - 1; window.Scene.mouse.y = (ty / innerHeight) * 2 - 1; }
      var spot = e.target.closest && e.target.closest('.spot');
      if (spot) { var r = spot.getBoundingClientRect(); spot.style.setProperty('--sx', (tx - r.left) + 'px'); spot.style.setProperty('--sy', (ty - r.top) + 'px'); }
    }, { passive: true });
    if (glow) (function loop() {
      gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
      glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }
})();

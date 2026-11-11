/* Interacciones de la página: navegación, progreso del scroll, ambientes por
   sección, revelados, contadores tipo odómetro, galería horizontal y detalles
   de puntero. */
(function () {
  'use strict';

  var Scene = window.Scene || { target: 0, p: 0, dayTarget: 0, mouse: { x: 0, y: 0 }, reduced: true };
  var reduced = Scene.reduced;
  var root = document.documentElement;
  if (reduced) root.classList.add('rm');

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }

  var stage = $('.stage'), hero = $('#hero'), arrive = $('#arrive'), flash = $('.flash');
  var header = $('#top'), nav = $('#nav'), glow = $('#glow');
  var services = $('.services'), track = $('#track'), svcN = $('#svc-n');
  var foot = $('.foot'), ghost = $('.ghost span');
  var sections = $$('[data-sec]'), moods = $$('.mood'), links = $$('.nav a');
  var horizontal = false, lastY = 0, activeId = null, ticking = false;

  // ---- Navegación: píldora que sigue a la sección activa -----------------
  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    var found = null;
    links.forEach(function (a) {
      var on = a.dataset.sec === id;
      a.classList.toggle('is-active', on);
      if (on) { a.setAttribute('aria-current', 'true'); found = a; } else { a.removeAttribute('aria-current'); }
    });
    movePill(found);
    moods.forEach(function (m) { m.classList.toggle('is-on', m.dataset.mood === id); });
  }
  function movePill(a) {
    if (!a) { nav.style.setProperty('--po', '0'); return; }
    nav.style.setProperty('--px', a.offsetLeft + 'px');
    nav.style.setProperty('--pw', a.offsetWidth + 'px');
    nav.style.setProperty('--po', '1');
  }

  // ---- Scroll -------------------------------------------------------------
  function setSvc(sp) {
    services.style.setProperty('--sp', sp.toFixed(4));
    var n = Math.round(sp * 8) + 1;
    svcN.textContent = (n < 10 ? '0' : '') + n;
  }

  function update() {
    ticking = false;
    var y = window.scrollY || window.pageYOffset, vh = window.innerHeight;
    var len = stage.offsetHeight - vh;
    var p = reduced ? 0 : clamp(y / Math.max(len, 1), 0, 1);
    Scene.target = p;

    // Del anochecer al amanecer a medida que se baja
    var docEnd = document.documentElement.scrollHeight - vh;
    Scene.dayTarget = smooth(0.25, 1, clamp((y - len) / Math.max(docEnd - len, 1), 0, 1));

    // Estados de la cabecera
    var top = y < 30, travel = !reduced && !top && y < len - vh * 0.1, dock = !top && !travel;
    header.classList.toggle('is-top', top);
    header.classList.toggle('is-travel', travel);
    header.classList.toggle('is-dock', dock);
    var menuOpen = document.body.classList.contains('menu-open');
    if (dock && !menuOpen && Math.abs(y - lastY) > 6) header.classList.toggle('is-hidden', y > lastY && y > len + 200);
    if (!dock) header.classList.remove('is-hidden');
    lastY = y;

    // Sección activa: la que cruza el centro de la pantalla
    var mid = vh * 0.5, id = null;
    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) { id = sections[i].id; break; }
    }
    setActive(id);

    if (horizontal) {
      var sr = services.getBoundingClientRect();
      var total = services.offsetHeight - vh;
      var sp = clamp(-sr.top / Math.max(total, 1), 0, 1);
      var max = track.scrollWidth - window.innerWidth;
      track.style.transform = 'translate3d(' + (-sp * max).toFixed(1) + 'px,0,0)';
      setSvc(sp);
    }

    if (ghost && !reduced) {
      var gr = ghost.parentNode.getBoundingClientRect();
      if (gr.bottom > 0 && gr.top < vh) ghost.style.transform = 'translate3d(' + ((gr.top - vh) * 0.35).toFixed(1) + 'px,0,0)';
    }

    // El sol del pie sale a medida que aparece
    var fr = foot.getBoundingClientRect();
    if (fr.top < vh) foot.style.setProperty('--rise', smooth(0, 1, clamp((vh - fr.top) / (vh * 0.9), 0, 1)).toFixed(3));

    if (reduced && Scene.render) Scene.render();
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }

  var gx = window.innerWidth / 2, gy = window.innerHeight / 2, tx = gx, ty = gy;
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

    gx += (tx - gx) * 0.12; gy += (ty - gy) * 0.12;
    glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
  };

  // ---- Servicios: scroll vertical que mueve la galería en horizontal -----
  function layoutServices() {
    horizontal = !reduced && window.innerWidth >= 900 && window.innerHeight >= 600;
    services.classList.toggle('is-horizontal', horizontal);
    if (horizontal) {
      var extra = track.scrollWidth - window.innerWidth;
      services.style.height = (window.innerHeight + Math.max(extra, 0)) + 'px';
    } else {
      services.style.height = '';
      track.style.transform = '';
    }
  }
  track.addEventListener('scroll', function () {
    if (horizontal) return;
    setSvc(clamp(track.scrollLeft / Math.max(track.scrollWidth - track.clientWidth, 1), 0, 1));
  }, { passive: true });

  // ---- Contadores tipo odómetro (sin saltos de ancho) --------------------
  $$('.odo').forEach(function (el) {
    var txt = el.dataset.value, n = 0;
    el.setAttribute('aria-label', txt);
    el.textContent = '';
    txt.split('').forEach(function (ch) {
      var s = document.createElement('span');
      s.setAttribute('aria-hidden', 'true');
      if (/\d/.test(ch)) {
        s.className = 'odo__col';
        var strip = document.createElement('span');
        strip.className = 'odo__strip';
        var html = '';
        for (var i = 0; i < 20; i++) html += '<i>' + (i % 10) + '</i>';
        strip.innerHTML = html;
        strip.dataset.to = String(10 + parseInt(ch, 10));
        strip.style.transitionDelay = (n++ * 110) + 'ms';
        if (reduced) strip.style.transform = 'translateY(-' + (strip.dataset.to * 5) + '%)';
        s.appendChild(strip);
      } else {
        s.className = 'odo__sym';
        s.textContent = ch;
      }
      el.appendChild(s);
    });
  });
  function rollOdo(el) {
    $$('.odo__strip').forEach(function (strip) {
      if (el.contains(strip)) strip.style.transform = 'translateY(-' + (strip.dataset.to * 5) + '%)';
    });
  }

  // ---- Revelados ---------------------------------------------------------
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      if (en.target.querySelector('.odo')) rollOdo(en.target);
      io.unobserve(en.target);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -6% 0px' }) : null;

  $$('.reveal').forEach(function (el) {
    var sibs = el.parentNode ? Array.prototype.filter.call(el.parentNode.children, function (c) { return c.classList.contains('reveal'); }) : [el];
    el.style.setProperty('--rd', Math.min(sibs.indexOf(el), 6) * 80 + 'ms');
    if (io) io.observe(el); else { el.classList.add('is-in'); rollOdo(el); }
  });

  // ---- Marquesina de clientes -------------------------------------------
  var CLIENTS = [
    ['acero-cristal', 'Acero Cristal', 'dark'], ['adriana-torres', 'Adriana Torres Productions'],
    ['psicomooc', 'Psicomooc'], ['contygo', 'Viajes Contygo', 'dark'], ['voces-que-conectan', 'Voces que Conectan'],
    ['hotel-manantial', 'Hotel Manantial Valencia'], ['delmar-restaurant', 'Delmar Restaurant'], ['lux-spa', 'Lux Spa'],
    ['trigus-bakery', "Trigu's Bakery"], ['icor', 'ICOR'], ['break-empresarial', 'Break Empresarial'],
    ['jd', 'Diseños JD'], ['cliente-01', 'Marca aliada de Torama'], ['cliente-06', 'Marca aliada de Torama']
  ];
  function fillRow(id, list) {
    var row = document.getElementById(id);
    if (!row) return;
    var html = '';
    for (var rep = 0; rep < 4; rep++) {             // 4 copias: el bucle no deja huecos ni en pantallas muy anchas
      list.forEach(function (c) {
        html += '<span class="logo' + (c[2] ? ' logo--dark' : '') + '"' + (rep ? ' aria-hidden="true"' : '') + '><img src="assets/clientes/' + c[0] + '.webp" alt="' + (rep ? '' : c[1]) + '" loading="lazy"></span>';
      });
    }
    row.innerHTML = html;
  }
  fillRow('logos-a', CLIENTS.slice(0, 7));
  fillRow('logos-b', CLIENTS.slice(7));

  // ---- Menú a pantalla completa -----------------------------------------
  var burger = $('#burger'), menu = $('#menu');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    if (open) header.classList.remove('is-hidden');
  }
  burger.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
  menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  // ---- Puntero: paralaje, luz, foco en tarjetas, imanes ------------------
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (fine && !reduced) {
    root.classList.add('has-pointer');
    window.addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY;
      Scene.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      Scene.mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    $$('.spot').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--sx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--sy', (e.clientY - r.top) + 'px');
      });
    });
    $$('.tilt').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--rx', (-y * 9).toFixed(2) + 'deg');
        el.style.setProperty('--ry', (x * 11).toFixed(2) + 'deg');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
    $$('.magnet').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * 0.18).toFixed(1) + 'px');
        el.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
    });
  }

  var yr = $('#year'); if (yr) yr.textContent = String(new Date().getFullYear());

  window.addEventListener('scroll', onScroll, { passive: true });
  function relayout() { layoutServices(); update(); var a = $('.nav a.is-active'); if (a) movePill(a); }
  window.addEventListener('resize', relayout);
  window.addEventListener('load', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  relayout();
})();

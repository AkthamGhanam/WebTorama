/* Página de casos de éxito: listado con filtros (?f=categoría), videoteca y
   vista de detalle (?c=slug). */
(function () {
  'use strict';
  var T = window.Torama, esc = T.esc;
  var grid = document.getElementById('grid'), filtros = document.getElementById('filtros'), vacio = document.getElementById('vacio');
  var lista = document.getElementById('lista'), cabecera = document.getElementById('lista-cabecera'), detalle = document.getElementById('detalle');
  var reel = document.getElementById('reel');
  var casos = [], filtro = 'todos';

  function cat(c) { return T.CATEGORIAS[c] || c || 'Proyecto'; }
  function img(p) { return esc(T.urlSegura(p, true)); }

  function tarjeta(c) {
    var m = (c.metricas || []).slice(0, 3).map(function (x) { return '<li><b>' + esc(x.valor) + '</b> ' + esc(x.etiqueta) + '</li>'; }).join('');
    var nv = (c.videos || []).length;
    return '<a class="pcard reveal spot" href="casos.html?c=' + encodeURIComponent(c.slug) + '">' +
      '<figure>' + (c.portada ? '<img src="' + img(c.portada) + '" alt="" loading="lazy">' : '') + '<span class="tag">' + esc(cat(c.categoria)) + '</span>' +
      (nv ? '<span class="vplay" aria-hidden="true"></span><span class="tag tag--count">' + nv + (nv === 1 ? ' video' : ' videos') + '</span>' : '') + '</figure>' +
      '<div class="pcard__body"><p class="pcard__meta">' + esc(c.cliente || '') + '</p><h2>' + esc(c.titulo) + '</h2><p>' + esc(c.resumen || '') + '</p>' +
      (m ? '<ul class="metrics metrics--sm">' + m + '</ul>' : '') + '<span class="more">Ver el caso</span></div></a>';
  }

  function pintarFiltros() {
    var usados = {};
    casos.forEach(function (c) { usados[c.categoria] = (usados[c.categoria] || 0) + 1; });
    var keys = Object.keys(T.CATEGORIAS).filter(function (k) { return usados[k]; })
      .concat(Object.keys(usados).filter(function (k) { return !T.CATEGORIAS[k]; }));
    filtros.innerHTML = '<button class="chip is-on" data-f="todos">Todos <i>' + casos.length + '</i></button>' +
      keys.map(function (k) { return '<button class="chip" data-f="' + esc(k) + '">' + esc(cat(k)) + ' <i>' + usados[k] + '</i></button>'; }).join('');
  }

  function pintarLista() {
    var vis = casos.filter(function (c) { return filtro === 'todos' || c.categoria === filtro; });
    // Videoteca: en "Producción audiovisual" se muestran todos los videos, listos para reproducir
    var vids = [];
    if (filtro === 'audiovisual') vis.forEach(function (c) { vids = vids.concat(videosDe(c)); });
    reel.hidden = !vids.length;
    reel.innerHTML = vids.length ? '<h2 class="reel__title">Videoteca <small>' + vids.length + ' videos</small></h2>' + muro(vids) + '<h2 class="reel__title">Los proyectos</h2>' : '';
    grid.innerHTML = vis.map(tarjeta).join('');
    vacio.hidden = vis.length > 0;
    T.revelar(lista);
  }

  // ---- Videos ----------------------------------------------------------------
  var cola = [], va = 0;
  function dur(s) { s = Math.round(s || 0); return s ? Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) : ''; }
  function videosDe(c) {
    return (c.videos || []).map(function (v) {
      return { src: T.urlSegura(v.src, true), poster: T.urlSegura(v.poster, true), titulo: v.titulo || c.titulo, h: v.orient === 'h', dur: v.dur, cliente: c.cliente || '' };
    }).filter(function (v) { return v.src; });
  }
  function mosaico(v, i, extra) {
    return '<button type="button" class="vtile reveal' + (v.h ? ' vtile--h' : '') + (extra || '') + '" data-v="' + i + '" aria-label="Reproducir: ' + esc(v.titulo) + '">' +
      (v.poster ? '<img src="' + esc(v.poster) + '" alt="" loading="lazy">' : '') + '<span class="vplay" aria-hidden="true"></span>' +
      '<span class="vtile__info"><b>' + esc(v.titulo) + '</b><small>' + esc([v.cliente, dur(v.dur)].filter(Boolean).join(' · ')) + '</small></span></button>';
  }
  /* Deja `vids` como lista de reproducción y devuelve el muro: verticales primero, horizontales aparte. */
  function muro(vids) {
    cola = vids;
    var ver = '', hor = '';
    vids.forEach(function (v, i) { if (v.h) hor += mosaico(v, i); else ver += mosaico(v, i); });
    return (ver ? '<div class="reel__row">' + ver + '</div>' : '') + (hor ? '<div class="reel__row reel__row--h">' + hor + '</div>' : '');
  }

  var vbox = document.getElementById('vbox'), player = vbox.querySelector('video'), vcap = vbox.querySelector('figcaption');
  function abrirVideo(i) {
    if (!cola.length) return;
    va = (i + cola.length) % cola.length;
    var v = cola[va];
    vbox.classList.toggle('vbox--h', v.h);
    vbox.classList.toggle('vbox--solo', cola.length < 2);
    player.poster = v.poster || ''; player.src = v.src;
    vcap.firstChild.textContent = v.titulo; vcap.lastChild.textContent = v.cliente;
    vbox.hidden = false; document.body.classList.add('menu-open');
    var p = player.play(); if (p && p.catch) p.catch(function () {});
  }
  function cerrarVideo() {
    player.pause(); player.removeAttribute('src'); player.load();
    vbox.hidden = true; document.body.classList.remove('menu-open');
  }
  vbox.addEventListener('click', function (e) {
    if (e.target.closest('.lightbox__nav--prev')) abrirVideo(va - 1);
    else if (e.target.closest('.lightbox__nav--next')) abrirVideo(va + 1);
    else if (!e.target.closest('figure')) cerrarVideo();
  });
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.vtile');
    if (t) abrirVideo(parseInt(t.getAttribute('data-v'), 10));
  });

  // Vista previa sin sonido al pasar el cursor por un video
  var conHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var activo = null;
  function previa(t, on) {
    var vid = t.querySelector('video');
    if (on) {
      var v = cola[parseInt(t.getAttribute('data-v'), 10)]; if (!v) return;
      if (!vid) {
        vid = document.createElement('video');
        vid.muted = true; vid.loop = true; vid.playsInline = true; vid.preload = 'auto'; vid.src = v.src;
        vid.addEventListener('playing', function () { if (activo === t) t.classList.add('is-playing'); });
        t.insertBefore(vid, t.querySelector('.vplay'));
      }
      var p = vid.play(); if (p && p.catch) p.catch(function () {});
    } else {
      t.classList.remove('is-playing');
      if (vid) { vid.pause(); try { vid.currentTime = 0; } catch (e) { /* aún sin datos */ } }
    }
  }
  if (conHover) document.addEventListener('pointerover', function (e) {
    var t = e.target.closest && e.target.closest('.vtile');
    if (t === activo) return;
    if (activo) previa(activo, false);
    activo = t; if (t) previa(t, true);
  });

  filtros.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    filtro = b.getAttribute('data-f');
    Array.prototype.forEach.call(filtros.children, function (x) { x.classList.toggle('is-on', x === b); });
    pintarLista();
  });

  // ---- Detalle -------------------------------------------------------------
  var fotos = [], actual = 0, lb = document.getElementById('lightbox'), lbImg = lb.querySelector('img');
  function abrir(i) {
    var n = fotos.length, paso = i < actual ? -1 : 1;
    actual = ((i % n) + n) % n;
    for (var k = 0; k < n && !fotos[actual]; k++) actual = (actual + paso + n) % n;
    if (!fotos[actual]) return;
    lbImg.src = fotos[actual]; lb.hidden = false; document.body.classList.add('menu-open');
  }
  function cerrar() { lb.hidden = true; document.body.classList.remove('menu-open'); }
  lb.addEventListener('click', function (e) {
    if (e.target.closest('.lightbox__nav--prev')) abrir(actual - 1);
    else if (e.target.closest('.lightbox__nav--next')) abrir(actual + 1);
    else if (e.target !== lbImg) cerrar();
  });
  document.addEventListener('keydown', function (e) {
    if (!vbox.hidden) {
      if (e.key === 'Escape') cerrarVideo(); else if (e.key === 'ArrowLeft') abrirVideo(va - 1); else if (e.key === 'ArrowRight') abrirVideo(va + 1);
      return;
    }
    if (lb.hidden) return;
    if (e.key === 'Escape') cerrar(); else if (e.key === 'ArrowLeft') abrir(actual - 1); else if (e.key === 'ArrowRight') abrir(actual + 1);
  });

  function pintarDetalle(c) {
    document.title = c.titulo + ' · Casos de éxito · Torama Agency';
    var vids = videosDe(c);
    cola = vids;
    // Con videos, la portada es el propio video; las fotos quedan para la galería
    fotos = (vids.length ? [''] : [c.portada]).concat(c.galeria || []).map(function (p) { return T.urlSegura(p, true); });
    if (!vids.length) fotos = fotos.filter(Boolean);
    var m = (c.metricas || []).map(function (x) { return '<li><b>' + esc(x.valor) + '</b><span>' + esc(x.etiqueta) + '</span></li>'; }).join('');
    var gal = fotos.slice(1).map(function (p, i) { return p ? '<button class="shot reveal" data-i="' + (i + 1) + '" aria-label="Ampliar imagen"><img src="' + esc(p) + '" alt="" loading="lazy"></button>' : ''; }).join('');
    var otros = casos.filter(function (o) { return o.slug !== c.slug && o.categoria === c.categoria; }).slice(0, 3);
    if (otros.length < 3) otros = otros.concat(casos.filter(function (o) { return o.slug !== c.slug && otros.indexOf(o) < 0; }).slice(0, 3 - otros.length));

    detalle.innerHTML =
      '<a class="back" href="casos.html">← Todos los casos</a>' +
      '<header class="detail__head"><span class="tag tag--solid">' + esc(cat(c.categoria)) + '</span>' +
      '<h1 class="title title--xl">' + esc(c.titulo) + '</h1><p class="detail__client">' + esc(c.cliente || '') + '</p></header>' +
      (m ? '<ul class="metrics reveal">' + m + '</ul>' : '') +
      '<div class="detail__grid' + (vids.length ? ' detail__grid--video' + (vids[0].h ? ' detail__grid--h' : '') : '') + '">' +
      (vids.length ? mosaico(vids[0], 0, ' vtile--cover') : fotos[0] ? '<button class="shot shot--cover reveal" data-i="0" aria-label="Ampliar imagen"><img src="' + esc(fotos[0]) + '" alt=""></button>' : '') +
      '<div class="prose reveal">' + T.md(c.cuerpo || c.resumen) + T.videoHTML(c.video) +
      '<p class="byline"><span class="avatar">' + esc(T.iniciales(c.autor || 'Torama Agency')) + '</span><span>Creado por <b>' + esc(c.autor || 'Torama Agency') + '</b><br>' + esc(T.fecha(c.fecha)) + '</span></p></div></div>' +
      (vids.length > 1 ? '<h2 class="detail__more detail__more--videos">Todos los videos</h2>' + muro(vids) : '') +
      (gal ? '<div class="gallery">' + gal + '</div>' : '') +
      (otros.length ? '<h2 class="detail__more">Más casos</h2><div class="grid grid--casos">' + otros.map(tarjeta).join('') + '</div>' : '');
    detalle.onclick = function (e) { var s = e.target.closest('.shot'); if (s) abrir(parseInt(s.getAttribute('data-i'), 10)); };
    cabecera.hidden = true; lista.hidden = true; detalle.hidden = false;
    T.revelar(detalle);
    window.scrollTo(0, 0);
  }

  T.cargar('casos').then(function (items) {
    casos = items;
    var slug = new URLSearchParams(location.search).get('c');
    var c = slug && casos.filter(function (x) { return x.slug === slug; })[0];
    if (c) { pintarDetalle(c); return; }
    var f = new URLSearchParams(location.search).get('f');
    pintarFiltros();
    var chip = f && filtros.querySelector('.chip[data-f="' + f.replace(/[^a-z-]/g, '') + '"]');
    if (chip) { filtro = chip.getAttribute('data-f'); Array.prototype.forEach.call(filtros.children, function (x) { x.classList.toggle('is-on', x === chip); }); }
    pintarLista();
  }).catch(function () {
    grid.innerHTML = '<p class="empty">No pudimos cargar los casos. Vuelve a intentarlo en un momento.</p>';
  });
})();

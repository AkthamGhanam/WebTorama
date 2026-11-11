/* Página de casos de éxito: listado con filtros y vista de detalle (?c=slug). */
(function () {
  'use strict';
  var T = window.Torama, esc = T.esc;
  var grid = document.getElementById('grid'), filtros = document.getElementById('filtros'), vacio = document.getElementById('vacio');
  var lista = document.getElementById('lista'), cabecera = document.getElementById('lista-cabecera'), detalle = document.getElementById('detalle');
  var casos = [], filtro = 'todos';

  function cat(c) { return T.CATEGORIAS[c] || c || 'Proyecto'; }
  function img(p) { return esc(T.urlSegura(p, true)); }

  function tarjeta(c) {
    var m = (c.metricas || []).slice(0, 3).map(function (x) { return '<li><b>' + esc(x.valor) + '</b> ' + esc(x.etiqueta) + '</li>'; }).join('');
    return '<a class="pcard reveal spot" href="casos.html?c=' + encodeURIComponent(c.slug) + '">' +
      '<figure>' + (c.portada ? '<img src="' + img(c.portada) + '" alt="" loading="lazy">' : '') + '<span class="tag">' + esc(cat(c.categoria)) + '</span></figure>' +
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
    grid.innerHTML = vis.map(tarjeta).join('');
    vacio.hidden = vis.length > 0;
    T.revelar(grid);
  }

  filtros.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    filtro = b.getAttribute('data-f');
    Array.prototype.forEach.call(filtros.children, function (x) { x.classList.toggle('is-on', x === b); });
    pintarLista();
  });

  // ---- Detalle -------------------------------------------------------------
  var fotos = [], actual = 0, lb = document.getElementById('lightbox'), lbImg = lb.querySelector('img');
  function abrir(i) { actual = (i + fotos.length) % fotos.length; lbImg.src = fotos[actual]; lb.hidden = false; document.body.classList.add('menu-open'); }
  function cerrar() { lb.hidden = true; document.body.classList.remove('menu-open'); }
  lb.addEventListener('click', function (e) {
    if (e.target.closest('.lightbox__nav--prev')) abrir(actual - 1);
    else if (e.target.closest('.lightbox__nav--next')) abrir(actual + 1);
    else if (e.target !== lbImg) cerrar();
  });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') cerrar(); else if (e.key === 'ArrowLeft') abrir(actual - 1); else if (e.key === 'ArrowRight') abrir(actual + 1);
  });

  function pintarDetalle(c) {
    document.title = c.titulo + ' · Casos de éxito · Torama Agency';
    fotos = [c.portada].concat(c.galeria || []).map(function (p) { return T.urlSegura(p, true); }).filter(Boolean);
    var m = (c.metricas || []).map(function (x) { return '<li><b>' + esc(x.valor) + '</b><span>' + esc(x.etiqueta) + '</span></li>'; }).join('');
    var gal = fotos.slice(1).map(function (p, i) { return '<button class="shot reveal" data-i="' + (i + 1) + '" aria-label="Ampliar imagen"><img src="' + esc(p) + '" alt="" loading="lazy"></button>'; }).join('');
    var otros = casos.filter(function (o) { return o.slug !== c.slug && o.categoria === c.categoria; }).slice(0, 3);
    if (otros.length < 3) otros = otros.concat(casos.filter(function (o) { return o.slug !== c.slug && otros.indexOf(o) < 0; }).slice(0, 3 - otros.length));

    detalle.innerHTML =
      '<a class="back" href="casos.html">← Todos los casos</a>' +
      '<header class="detail__head"><span class="tag tag--solid">' + esc(cat(c.categoria)) + '</span>' +
      '<h1 class="title title--xl">' + esc(c.titulo) + '</h1><p class="detail__client">' + esc(c.cliente || '') + '</p></header>' +
      (m ? '<ul class="metrics reveal">' + m + '</ul>' : '') +
      '<div class="detail__grid">' +
      (fotos[0] ? '<button class="shot shot--cover reveal" data-i="0" aria-label="Ampliar imagen"><img src="' + esc(fotos[0]) + '" alt=""></button>' : '') +
      '<div class="prose reveal">' + T.md(c.cuerpo || c.resumen) + T.videoHTML(c.video) +
      '<p class="byline"><span class="avatar">' + esc(T.iniciales(c.autor || 'Torama Agency')) + '</span><span>Creado por <b>' + esc(c.autor || 'Torama Agency') + '</b><br>' + esc(T.fecha(c.fecha)) + '</span></p></div></div>' +
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
    pintarFiltros(); pintarLista();
  }).catch(function () {
    grid.innerHTML = '<p class="empty">No pudimos cargar los casos. Vuelve a intentarlo en un momento.</p>';
  });
})();

/* Noticiero: listado con búsqueda y categorías, y vista de lectura (?n=slug). */
(function () {
  'use strict';
  var T = window.Torama, esc = T.esc;
  var grid = document.getElementById('grid'), dest = document.getElementById('destacada'), filtros = document.getElementById('filtros');
  var buscar = document.getElementById('buscar'), vacio = document.getElementById('vacio');
  var lista = document.getElementById('lista'), cabecera = document.getElementById('lista-cabecera'), detalle = document.getElementById('detalle');
  var noticias = [], filtro = 'todas', texto = '';

  function img(p) { return esc(T.urlSegura(p, true)); }
  function firma(n) {
    return '<p class="byline byline--sm"><span class="avatar">' + esc(T.iniciales(n.autor)) + '</span><span>Creado por <b>' + esc(n.autor || 'Torama Agency') + '</b><br>' +
      esc(T.fecha(n.fecha)) + ' · ' + esc(T.lectura(n.cuerpo)) + '</span></p>';
  }
  function tarjeta(n, grande) {
    return '<a class="pcard pcard--post reveal spot' + (grande ? ' pcard--feature' : '') + '" href="noticias.html?n=' + encodeURIComponent(n.slug) + '">' +
      '<figure>' + (n.portada ? '<img src="' + img(n.portada) + '" alt="" loading="lazy">' : '<span class="pcard__ph"></span>') +
      (n.categoria ? '<span class="tag">' + esc(n.categoria) + '</span>' : '') + '</figure>' +
      '<div class="pcard__body">' + (grande ? '<p class="pcard__meta">Destacada</p>' : '') + '<h2>' + esc(n.titulo) + '</h2><p>' + esc(n.extracto || '') + '</p>' + firma(n) + '</div></a>';
  }

  function pintarFiltros() {
    var cats = [];
    noticias.forEach(function (n) { if (n.categoria && cats.indexOf(n.categoria) < 0) cats.push(n.categoria); });
    filtros.innerHTML = '<button class="chip is-on" data-f="todas">Todas</button>' +
      cats.map(function (c) { return '<button class="chip" data-f="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
  }

  function pintarLista() {
    var q = texto.toLowerCase();
    var vis = noticias.filter(function (n) {
      if (filtro !== 'todas' && n.categoria !== filtro) return false;
      return !q || [n.titulo, n.extracto, n.autor, n.cuerpo].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var libre = filtro === 'todas' && !q;
    var primera = libre ? (vis.filter(function (n) { return n.destacado; })[0] || vis[0]) : null;
    dest.innerHTML = primera ? tarjeta(primera, true) : '';
    grid.innerHTML = vis.filter(function (n) { return n !== primera; }).map(function (n) { return tarjeta(n); }).join('');
    vacio.hidden = vis.length > 0;
    T.revelar(lista);
  }

  filtros.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    filtro = b.getAttribute('data-f');
    Array.prototype.forEach.call(filtros.children, function (x) { x.classList.toggle('is-on', x === b); });
    pintarLista();
  });
  buscar.addEventListener('input', function () { texto = buscar.value.trim(); pintarLista(); });

  function pintarDetalle(n) {
    document.title = n.titulo + ' · Noticiero Torama';
    var url = location.href, t = encodeURIComponent(n.titulo + ' · Noticiero Torama'), u = encodeURIComponent(url);
    var otras = noticias.filter(function (o) { return o.slug !== n.slug; }).slice(0, 3);
    detalle.innerHTML =
      '<a class="back" href="noticias.html">← Volver al Noticiero</a>' +
      '<header class="detail__head">' + (n.categoria ? '<span class="tag tag--solid">' + esc(n.categoria) + '</span>' : '') +
      '<h1 class="title">' + esc(n.titulo) + '</h1>' + (n.extracto ? '<p class="detail__lead">' + esc(n.extracto) + '</p>' : '') +
      '<p class="byline"><span class="avatar">' + esc(T.iniciales(n.autor)) + '</span><span>Creado por <b>' + esc(n.autor || 'Torama Agency') + '</b>' +
      (n.cargo ? ' · ' + esc(n.cargo) : '') + '<br>' + esc(T.fecha(n.fecha)) + ' · ' + esc(T.lectura(n.cuerpo)) + '</span></p></header>' +
      (n.portada ? '<figure class="post__cover reveal"><img src="' + img(n.portada) + '" alt=""></figure>' : '') +
      '<div class="prose prose--post reveal">' + T.md(n.cuerpo) + '</div>' +
      '<div class="share reveal"><span>Compartir</span>' +
      '<a href="https://wa.me/?text=' + t + '%20' + u + '" target="_blank" rel="noopener">WhatsApp</a>' +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + u + '" target="_blank" rel="noopener">Facebook</a>' +
      '<a href="https://twitter.com/intent/tweet?text=' + t + '&url=' + u + '" target="_blank" rel="noopener">X</a>' +
      '<button type="button" id="copiar">Copiar enlace</button></div>' +
      (otras.length ? '<h2 class="detail__more">Más noticias</h2><div class="grid grid--noticias">' + otras.map(function (o) { return tarjeta(o); }).join('') + '</div>' : '');
    var copiar = document.getElementById('copiar');
    copiar.addEventListener('click', function () {
      (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(function () { copiar.textContent = '¡Enlace copiado!'; }, function () { copiar.textContent = url; });
    });
    cabecera.hidden = true; lista.hidden = true; detalle.hidden = false;
    T.revelar(detalle);
    window.scrollTo(0, 0);
  }

  T.cargar('noticias').then(function (items) {
    noticias = items;
    var slug = new URLSearchParams(location.search).get('n');
    var n = slug && noticias.filter(function (x) { return x.slug === slug; })[0];
    if (n) { pintarDetalle(n); return; }
    pintarFiltros(); pintarLista();
  }).catch(function () {
    grid.innerHTML = '<p class="empty">No pudimos cargar las noticias. Vuelve a intentarlo en un momento.</p>';
  });
})();

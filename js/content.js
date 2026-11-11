/* Utilidades compartidas de contenido: carga de datos, formato de texto
   (Markdown seguro), fechas y envío de formularios por correo. */
(function () {
  'use strict';

  var T = (window.Torama = window.Torama || {});

  T.EMAIL = 'Contenido.toramaagency@gmail.com';
  T.CATEGORIAS = {
    'meta-ads': 'Meta Ads',
    'audiovisual': 'Producción audiovisual',
    'contenido': 'Creación de contenido',
    'ia': 'Contenido con IA',
    'fotografia': 'Fotografía',
    'diseno': 'Diseño gráfico',
    'auditoria': 'Auditoría',
    'formaciones': 'Formaciones'
  };

  T.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  T.slug = function (s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'entrada';
  };

  T.fecha = function (iso) {
    if (!iso) return '';
    var d = new Date(iso + (iso.length <= 10 ? 'T12:00:00' : ''));
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  T.lectura = function (texto) {
    var n = String(texto || '').trim().split(/\s+/).length;
    return Math.max(1, Math.round(n / 200)) + ' min de lectura';
  };

  T.iniciales = function (nombre) {
    return String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join('');
  };

  /* Solo se aceptan enlaces e imágenes con destinos seguros */
  T.urlSegura = function (u, soloWeb) {
    u = String(u || '').trim();
    if (/^https?:\/\//i.test(u)) return u;
    if (!soloWeb && /^mailto:/i.test(u)) return u;
    if (/^(content|assets)\/[\w\-./%]+$/i.test(u) && u.indexOf('..') < 0) return u;
    return '';
  };

  T.youtubeId = function (u) {
    var m = String(u || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
    return m ? m[1] : '';
  };
  T.videoHTML = function (u) {
    var id = T.youtubeId(u);
    if (id) return '<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/' + id + '" title="Video" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>';
    var safe = T.urlSegura(u, true);
    return safe ? '<p><a class="btn btn--glass" href="' + T.esc(safe) + '" target="_blank" rel="noopener">Ver el video</a></p>' : '';
  };

  /* Markdown reducido y seguro: primero se escapa todo el HTML y después se
     aplican solo los formatos permitidos. `resolver` permite al panel mostrar
     imágenes que aún no se han publicado. */
  T.md = function (src, resolver) {
    var res = resolver || function (p) { return p; };
    function inline(t) {
      t = T.esc(t);
      t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, url) {
        var u = T.urlSegura(url.replace(/&amp;/g, '&'), true);
        return u ? '<img src="' + T.esc(res(u)) + '" alt="' + alt + '" loading="lazy">' : '';
      });
      t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, txt, url) {
        var u = T.urlSegura(url.replace(/&amp;/g, '&'));
        return u ? '<a href="' + T.esc(u) + '" target="_blank" rel="noopener">' + txt + '</a>' : txt;
      });
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
      return t;
    }
    var lines = String(src || '').replace(/\r/g, '').split('\n');
    var out = [], para = [], list = null;
    function flushPara() { if (para.length) { out.push('<p>' + para.map(inline).join('<br>') + '</p>'); para = []; } }
    function flushList() { if (list) { out.push('<' + list.tag + '>' + list.items.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</' + list.tag + '>'); list = null; } }
    lines.forEach(function (raw) {
      var line = raw.trim(), m;
      if (!line) { flushPara(); flushList(); return; }
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { flushPara(); flushList(); var lvl = Math.min(m[1].length + 1, 4); out.push('<h' + lvl + '>' + inline(m[2]) + '</h' + lvl + '>'); return; }
      if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); return; }
      if ((m = line.match(/^[-*]\s+(.*)$/))) { flushPara(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); return; }
      if ((m = line.match(/^\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); return; }
      if (/^https?:\/\/\S+$/.test(line) && T.youtubeId(line)) { flushPara(); flushList(); out.push(T.videoHTML(line)); return; }
      flushList(); para.push(line);
    });
    flushPara(); flushList();
    return out.join('\n');
  };

  /* Datos publicados en /content. Se evita la caché para ver lo recién publicado. */
  T.cargar = function (nombre) {
    return fetch('content/' + nombre + '.json?t=' + Math.floor(Date.now() / 60000), { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('No se pudo cargar el contenido'); return r.json(); })
      .then(function (d) {
        return (d.items || []).filter(function (i) { return i.publicado !== false; })
          .sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')); });
      });
  };

  /* Formularios que llegan por correo (servicio FormSubmit, sin servidor propio). */
  T.formulario = function (form) {
    var estado = form.querySelector('.form__status');
    var boton = form.querySelector('[type="submit"]');
    function decir(tipo, html) { estado.className = 'form__status is-' + tipo; estado.innerHTML = html; }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var datos = {}, cuerpo = [];
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.type === 'submit') return;
        if (el.name === '_honey') { datos._honey = el.value; return; }
        var etiqueta = el.getAttribute('data-label') || el.name;
        datos[etiqueta] = el.value;
        if (el.value) cuerpo.push(etiqueta + ': ' + el.value);
      });
      if (datos._honey) return;                          // trampa para bots
      datos._subject = form.getAttribute('data-subject') || 'Mensaje desde la web de Torama';
      datos._template = 'table';
      datos._captcha = 'false';

      var mailto = 'mailto:' + T.EMAIL + '?subject=' + encodeURIComponent(datos._subject) + '&body=' + encodeURIComponent(cuerpo.join('\n'));
      boton.disabled = true;
      decir('wait', 'Enviando…');
      fetch('https://formsubmit.co/ajax/' + T.EMAIL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(datos)
      }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          boton.disabled = false;
          if (res.ok && String(res.j.success) === 'true') {
            form.reset();
            decir('ok', form.getAttribute('data-ok') || '¡Mensaje enviado! Te responderemos muy pronto.');
          } else {
            decir('error', 'No pudimos enviarlo desde aquí. <a href="' + T.esc(mailto) + '">Envíalo por correo</a> o escríbenos por <a href="https://wa.me/13106906822" target="_blank" rel="noopener">WhatsApp</a>.');
          }
        }).catch(function () {
          boton.disabled = false;
          decir('error', 'No pudimos enviarlo desde aquí. <a href="' + T.esc(mailto) + '">Envíalo por correo</a> o escríbenos por <a href="https://wa.me/13106906822" target="_blank" rel="noopener">WhatsApp</a>.');
        });
    });
  };

  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('form[data-torama-form]'), T.formulario);
  });
})();

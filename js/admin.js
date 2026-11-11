/* Panel del equipo. Publica noticias y casos de éxito guardándolos en el
   repositorio de GitHub del sitio (sin servidor propio):
   - los datos viven en content/noticias.json y content/casos.json
   - las imágenes se reducen en el navegador y se suben a content/media/
   - cada guardado es un único commit en la rama principal, y la rama que
     sirve GitHub Pages se actualiza al mismo commit. */
(function () {
  'use strict';

  var T = window.Torama, esc = T.esc;
  var CFG = { owner: 'AkthamGhanam', repo: 'WebTorama', branch: 'main', publish: 'gh-pages' };
  var ROOT = 'https://api.github.com';
  var API = ROOT + '/repos/' + CFG.owner + '/' + CFG.repo;
  var RAW = 'https://raw.githubusercontent.com/' + CFG.owner + '/' + CFG.repo + '/' + CFG.branch + '/';
  var KEY = 'torama_panel_token', KEY_AUTOR = 'torama_panel_autor';

  var NOMBRES = { noticias: { uno: 'noticia', una: 'Nueva noticia', titulo: 'Noticiero', pagina: 'noticias.html?n=' }, casos: { uno: 'caso', una: 'Nuevo caso', titulo: 'Casos de éxito', pagina: 'casos.html?c=' } };
  var st = { token: '', user: null, tipo: 'noticias', data: { noticias: [], casos: [] }, edit: null, pend: {}, busca: '', sucio: false };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  // ---- Avisos --------------------------------------------------------------
  function toast(msg, tipo, ms) {
    var el = document.createElement('p');
    el.className = 'toast is-' + (tipo || 'ok');
    el.innerHTML = msg;
    $('#toasts').appendChild(el);
    setTimeout(function () { el.classList.add('is-out'); setTimeout(function () { el.remove(); }, 400); }, ms || 5200);
  }

  // ---- GitHub ----------------------------------------------------------------
  function gh(url, opts) {
    opts = opts || {};
    var headers = { Authorization: 'Bearer ' + st.token, Accept: opts.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            var m = ''; try { m = JSON.parse(t).message; } catch (e) { m = t; }
            var err = new Error(m || ('Error ' + r.status)); err.status = r.status; throw err;
          });
        }
        return opts.raw ? r.text() : (r.status === 204 ? null : r.json());
      });
  }

  function leer(tipo) {
    return gh(API + '/contents/content/' + tipo + '.json?ref=' + CFG.branch, { raw: true })
      .then(function (txt) { var d = JSON.parse(txt); return d.items || []; })
      .catch(function (e) { if (e.status === 404) return []; throw e; });
  }

  /* Un solo commit con todos los archivos (datos + imágenes nuevas). */
  function commit(files, mensaje) {
    var head, baseTree;
    return gh(API + '/git/ref/heads/' + CFG.branch).then(function (ref) {
      head = ref.object.sha;
      return gh(API + '/git/commits/' + head);
    }).then(function (c) {
      baseTree = c.tree.sha;
      return Promise.all(files.map(function (f) {
        return gh(API + '/git/blobs', { method: 'POST', body: { content: f.content, encoding: f.encoding } })
          .then(function (b) { return { path: f.path, mode: '100644', type: 'blob', sha: b.sha }; });
      }));
    }).then(function (tree) {
      return gh(API + '/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: tree } });
    }).then(function (t) {
      return gh(API + '/git/commits', { method: 'POST', body: { message: mensaje, tree: t.sha, parents: [head] } });
    }).then(function (nc) {
      return gh(API + '/git/refs/heads/' + CFG.branch, { method: 'PATCH', body: { sha: nc.sha } }).then(function () {
        if (!CFG.publish || CFG.publish === CFG.branch) return nc;
        // La rama publicada se pone al día; si no existe, no pasa nada.
        return gh(API + '/git/refs/heads/' + CFG.publish, { method: 'PATCH', body: { sha: nc.sha, force: true } }).then(function () { return nc; }, function () { return nc; });
      });
    });
  }

  /* Vuelve a leer la última versión antes de aplicar el cambio, para no pisar
     lo que otra persona haya publicado mientras tanto. */
  function guardar(tipo, cambio, mensaje, rutas) {
    function intento(n) {
      return leer(tipo).then(function (items) {
        items = cambio(items);
        var files = [{ path: 'content/' + tipo + '.json', content: JSON.stringify({ items: items }, null, 2) + '\n', encoding: 'utf-8' }];
        (rutas || []).forEach(function (p) { if (st.pend[p]) files.push({ path: p, content: st.pend[p].b64, encoding: 'base64' }); });
        return commit(files, mensaje).then(function () { st.data[tipo] = items; (rutas || []).forEach(function (p) { if (st.pend[p]) st.pend[p].subida = true; }); });
      }).catch(function (e) {
        if (n < 2 && (e.status === 422 || e.status === 409)) return intento(n + 1);
        throw e;
      });
    }
    return intento(0);
  }

  // ---- Acceso ------------------------------------------------------------------
  function entrar(token, recordar) {
    st.token = token.trim();
    var status = $('#login-status');
    status.className = 'form__status is-wait'; status.textContent = 'Comprobando la llave…';
    return gh(ROOT + '/user').then(function (u) {
      st.user = u;
      return gh(API);
    }).then(function (repo) {
      if (!repo.permissions || !repo.permissions.push) { var e = new Error('sin-permiso'); e.status = 403; throw e; }
      try { sessionStorage.setItem(KEY, st.token); if (recordar) localStorage.setItem(KEY, st.token); else localStorage.removeItem(KEY); } catch (e) { /* almacenamiento bloqueado */ }
      return Promise.all([leer('noticias'), leer('casos')]);
    }).then(function (res) {
      st.data.noticias = res[0]; st.data.casos = res[1];
      $('#login').hidden = true; $('#app').hidden = false;
      $('#usuario').textContent = st.user.name || st.user.login;
      status.textContent = '';
      pintarLista();
    }).catch(function (e) {
      st.token = '';
      try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (x) { /* nada */ }
      $('#login').hidden = false; $('#app').hidden = true;
      status.className = 'form__status is-error';
      status.textContent = e.status === 401 ? 'La llave no es válida o ha caducado.'
        : (e.status === 403 || e.status === 404) ? 'La llave no tiene permiso de escritura sobre el repositorio WebTorama.'
          : 'No pudimos conectar con GitHub. Revisa tu conexión e inténtalo de nuevo.';
    });
  }

  $('#login-form').addEventListener('submit', function (e) { e.preventDefault(); entrar($('#token').value, $('#recordar').checked); });
  $('#salir').addEventListener('click', function () {
    try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) { /* nada */ }
    location.reload();
  });

  // ---- Listado -------------------------------------------------------------------
  function src(p) {
    if (!p) return '';
    if (st.pend[p]) return st.pend[p].url;
    var u = T.urlSegura(p, true);
    return /^(content|assets)\//.test(u) ? RAW + u : u;
  }
  function hoy() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function autorPorDefecto() {
    var a = ''; try { a = localStorage.getItem(KEY_AUTOR) || ''; } catch (e) { /* nada */ }
    return a || (st.user && (st.user.name || st.user.login)) || '';
  }

  function pintarLista() {
    var n = NOMBRES[st.tipo], items = st.data[st.tipo].slice().sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')); });
    var q = st.busca.toLowerCase();
    if (q) items = items.filter(function (i) { return [i.titulo, i.autor, i.cliente, i.categoria].join(' ').toLowerCase().indexOf(q) >= 0; });
    $('#lista-titulo').textContent = n.titulo;
    var total = st.data[st.tipo].length, pub = st.data[st.tipo].filter(function (i) { return i.publicado !== false; }).length;
    $('#lista-sub').textContent = total + (total === 1 ? ' entrada' : ' entradas') + ' · ' + pub + ' publicadas · ' + (total - pub) + ' en borrador';
    $('#nuevo').textContent = '+ ' + n.una;
    $$('#tabs button').forEach(function (b) { b.classList.toggle('is-on', b.dataset.tipo === st.tipo); });
    $('#rows').innerHTML = items.length ? items.map(function (i) {
      var cat = st.tipo === 'casos' ? (T.CATEGORIAS[i.categoria] || i.categoria || '') : (i.categoria || '');
      return '<li class="row" data-id="' + esc(i.id) + '">' +
        '<span class="row__thumb">' + (i.portada ? '<img src="' + esc(src(i.portada)) + '" alt="" loading="lazy">' : '') + '</span>' +
        '<span class="row__main"><b>' + esc(i.titulo) + '</b><small>' + esc([cat, i.cliente].filter(Boolean).join(' · ')) + '</small></span>' +
        '<span class="row__by">Creado por <b>' + esc(i.autor || '—') + '</b><small>' + esc(T.fecha(i.fecha)) + '</small></span>' +
        '<span class="badge ' + (i.publicado !== false ? 'is-pub' : 'is-draft') + '">' + (i.publicado !== false ? 'Publicado' : 'Borrador') + '</span>' +
        '<span class="row__acts"><button data-act="editar">Editar</button><button data-act="borrar" class="danger">Eliminar</button></span></li>';
    }).join('') : '<li class="empty">Aún no hay nada aquí. Crea la primera entrada.</li>';
  }

  $('#tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !salirDelEditor()) return;
    st.tipo = b.dataset.tipo; st.busca = ''; $('#abuscar').value = ''; pintarLista();
  });
  $('#abuscar').addEventListener('input', function () { st.busca = this.value.trim(); pintarLista(); });
  $('#nuevo').addEventListener('click', function () { editar(null); });
  $('#rows').addEventListener('click', function (e) {
    var b = e.target.closest('button'), row = e.target.closest('.row'); if (!row) return;
    var item = st.data[st.tipo].filter(function (i) { return i.id === row.dataset.id; })[0]; if (!item) return;
    if (b && b.dataset.act === 'borrar') return borrar(item);
    editar(item);
  });

  function borrar(item) {
    if (!confirm('¿Eliminar "' + item.titulo + '"? Esta acción no se puede deshacer desde el panel.')) return;
    toast('Eliminando…', 'wait', 2500);
    guardar(st.tipo, function (items) { return items.filter(function (i) { return i.id !== item.id; }); }, 'Panel: elimina ' + NOMBRES[st.tipo].uno + ' "' + item.titulo + '"')
      .then(function () { toast('Entrada eliminada.'); mostrarLista(); })
      .catch(function (e) { toast('No se pudo eliminar: ' + esc(e.message), 'error'); });
  }

  // ---- Imágenes: se reducen en el navegador antes de subirlas ---------------------
  function prepararImagen(file, base) {
    return new Promise(function (ok, mal) {
      if (!/^image\//.test(file.type)) return mal(new Error('El archivo no es una imagen.'));
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) {
          if (!blob) return mal(new Error('No se pudo procesar la imagen.'));
          var ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
          var path = 'content/media/' + st.tipo + '/' + T.slug(base || 'imagen').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
          var fr = new FileReader();
          fr.onload = function () { st.pend[path] = { b64: String(fr.result).split(',')[1], url: URL.createObjectURL(blob) }; ok(path); };
          fr.onerror = function () { mal(new Error('No se pudo leer la imagen.')); };
          fr.readAsDataURL(blob);
        }, 'image/webp', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); mal(new Error('No se pudo abrir la imagen.')); };
      img.src = url;
    });
  }
  function elegirImagenes(multiple) {
    return new Promise(function (ok) {
      var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = !!multiple;
      inp.onchange = function () { ok(Array.prototype.slice.call(inp.files || [])); };
      inp.click();
    });
  }

  // ---- Editor --------------------------------------------------------------------
  function campo(label, html, extra) { return '<label class="' + (extra || '') + '"><span>' + label + '</span>' + html + '</label>'; }
  function opcionesCat(v) {
    return Object.keys(T.CATEGORIAS).map(function (k) { return '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(T.CATEGORIAS[k]) + '</option>'; }).join('');
  }

  function editar(item) {
    var esNuevo = !item, tipo = st.tipo, n = NOMBRES[tipo];
    var e = st.edit = item ? JSON.parse(JSON.stringify(item)) : { id: '', titulo: '', autor: autorPorDefecto(), fecha: hoy(), publicado: true, destacado: false, cuerpo: '', portada: '', galeria: [], metricas: [], categoria: tipo === 'casos' ? 'meta-ads' : '' };
    e.galeria = e.galeria || []; e.metricas = e.metricas || [];
    st.sucio = false;
    var cats = []; st.data.noticias.forEach(function (x) { if (x.categoria && cats.indexOf(x.categoria) < 0) cats.push(x.categoria); });

    var html = '<form class="editor form" id="editor" novalidate>' +
      '<div class="editor__top"><button type="button" class="back" data-act="volver">← Volver</button><h1 class="title">' + (esNuevo ? n.una : 'Editar ' + n.uno) + '</h1></div>' +
      '<div class="editor__cols"><div class="editor__main">' +
      campo('Título', '<input type="text" name="titulo" value="' + esc(e.titulo) + '" required maxlength="140" placeholder="Un título claro">');
    if (tipo === 'casos') {
      html += '<div class="form__row">' + campo('Cliente o marca', '<input type="text" name="cliente" value="' + esc(e.cliente || '') + '" placeholder="Nombre del cliente">') +
        campo('Servicio', '<select name="categoria">' + opcionesCat(e.categoria) + '</select>') + '</div>' +
        campo('Resumen', '<textarea name="resumen" rows="2" placeholder="Una frase con el resultado principal">' + esc(e.resumen || '') + '</textarea>') +
        '<fieldset class="box"><legend>Resultados en números <small>(opcional)</small></legend><div id="metricas"></div><button type="button" class="mini" data-act="mas-metrica">+ Añadir resultado</button></fieldset>';
    } else {
      html += campo('Extracto', '<textarea name="extracto" rows="2" placeholder="Una o dos frases que resumen la noticia">' + esc(e.extracto || '') + '</textarea>');
    }
    html += '<div class="mdbox"><div class="mdbar" role="toolbar" aria-label="Formato">' +
      '<span class="mdbar__label">Contenido</span>' +
      '<button type="button" data-md="b" title="Negrita"><b>N</b></button><button type="button" data-md="i" title="Cursiva"><i>C</i></button>' +
      '<button type="button" data-md="h" title="Subtítulo">Subtítulo</button><button type="button" data-md="ul" title="Lista">Lista</button>' +
      '<button type="button" data-md="q" title="Cita">Cita</button><button type="button" data-md="a" title="Enlace">Enlace</button>' +
      '<button type="button" data-md="img" title="Insertar imagen">Imagen</button><button type="button" data-md="yt" title="Video de YouTube">Video</button>' +
      '<button type="button" class="mdbar__prev" data-act="preview">Vista previa</button></div>' +
      '<textarea name="cuerpo" rows="14" placeholder="Escribe aquí…">' + esc(e.cuerpo || '') + '</textarea>' +
      '<div class="prose prose--post mdprev" id="mdprev" hidden></div></div>';
    if (tipo === 'casos') {
      html += '<fieldset class="box"><legend>Galería</legend><div class="thumbs" id="galeria"></div><button type="button" class="mini" data-act="mas-fotos">+ Añadir fotos</button></fieldset>' +
        campo('Video <small>(enlace de YouTube u otro, opcional)</small>', '<input type="url" name="video" value="' + esc(e.video || '') + '" placeholder="https://">');
    }
    html += '</div><aside class="editor__side">' +
      '<fieldset class="box"><legend>Portada</legend><div class="cover" id="portada"></div><button type="button" class="mini" data-act="portada">Subir imagen</button></fieldset>' +
      campo('Creado por', '<input type="text" name="autor" value="' + esc(e.autor || '') + '" required placeholder="Nombre de quien firma">') +
      (tipo === 'noticias' ? campo('Cargo o rol <small>(opcional)</small>', '<input type="text" name="cargo" value="' + esc(e.cargo || '') + '" placeholder="Ej. Community Manager">') +
        campo('Categoría', '<input type="text" name="categoria" value="' + esc(e.categoria || '') + '" list="cats" placeholder="Ej. Equipo, Campañas…"><datalist id="cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>') : '') +
      campo('Fecha', '<input type="date" name="fecha" value="' + esc(e.fecha || hoy()) + '">') +
      '<label class="check"><input type="checkbox" name="destacado"' + (e.destacado ? ' checked' : '') + '> Destacar</label>' +
      '<p class="editor__state">Estado actual: <b>' + (esNuevo ? 'sin guardar' : (e.publicado !== false ? 'publicado' : 'borrador')) + '</b></p>' +
      '<div class="editor__acts"><button class="btn btn--red" type="submit" data-pub="1">Publicar</button><button class="btn btn--glass" type="submit" data-pub="0">Guardar borrador</button></div>' +
      (esNuevo ? '' : '<button type="button" class="mini danger" data-act="eliminar">Eliminar ' + n.uno + '</button>') +
      '</aside></div></form>';

    var view = $('#vista-editor');
    view.innerHTML = html; view.hidden = false; $('#vista-lista').hidden = true;
    window.scrollTo(0, 0);
    pintarPortada(); pintarGaleria(); pintarMetricas();
    var form = $('#editor'), ta = form.elements.cuerpo, pubFlag = '1';

    form.addEventListener('input', function () { st.sucio = true; });
    form.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.pub) { pubFlag = b.dataset.pub; return; }
      var act = b.dataset.act, md = b.dataset.md;
      if (md) return formato(ta, md, e);
      if (act === 'volver') { if (salirDelEditor()) mostrarLista(); }
      else if (act === 'preview') {
        var prev = $('#mdprev'), on = prev.hidden;
        if (on) prev.innerHTML = T.md(ta.value, src) || '<p><em>Sin contenido todavía.</em></p>';
        prev.hidden = !on; ta.hidden = on; b.textContent = on ? 'Seguir editando' : 'Vista previa';
      }
      else if (act === 'portada') subir(false, form.elements.titulo.value).then(function (ps) { if (ps[0]) { e.portada = ps[0]; st.sucio = true; pintarPortada(); } });
      else if (act === 'quitar-portada') { e.portada = ''; st.sucio = true; pintarPortada(); }
      else if (act === 'mas-fotos') subir(true, form.elements.titulo.value).then(function (ps) { e.galeria = e.galeria.concat(ps); st.sucio = true; pintarGaleria(); });
      else if (act === 'quitar-foto') { e.galeria.splice(parseInt(b.dataset.i, 10), 1); st.sucio = true; pintarGaleria(); }
      else if (act === 'mas-metrica') { leerMetricas(); e.metricas.push({ valor: '', etiqueta: '' }); pintarMetricas(); }
      else if (act === 'quitar-metrica') { leerMetricas(); e.metricas.splice(parseInt(b.dataset.i, 10), 1); st.sucio = true; pintarMetricas(); }
      else if (act === 'eliminar') borrar(item);
    });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!form.reportValidity()) return;
      ['titulo', 'cliente', 'categoria', 'resumen', 'extracto', 'cuerpo', 'video', 'autor', 'cargo', 'fecha'].forEach(function (k) { if (form.elements[k]) e[k] = form.elements[k].value.trim(); });
      e.destacado = form.elements.destacado.checked;
      e.publicado = pubFlag === '1';
      if (tipo === 'casos') { leerMetricas(); e.metricas = e.metricas.filter(function (m) { return m.valor || m.etiqueta; }); } else { delete e.galeria; delete e.metricas; }
      if (e.video && !T.urlSegura(e.video, true)) { toast('El enlace del video debe empezar por https://', 'error'); return; }
      try { localStorage.setItem(KEY_AUTOR, e.autor); } catch (x) { /* nada */ }

      var otros = st.data[tipo].filter(function (i) { return i.id !== e.id; });
      if (!e.slug) {                                    // la dirección de una entrada no cambia al editarla
        var base = T.slug(e.titulo), slug = base, k = 2;
        while (otros.some(function (i) { return i.slug === slug; })) slug = base + '-' + (k++);
        e.slug = slug;
      }
      if (!e.id) e.id = e.slug + '-' + Date.now().toString(36);

      var rutas = [e.portada].concat(e.galeria || []).concat((e.cuerpo.match(/content\/media\/[\w\-./]+/g) || []))
        .filter(function (p) { return p && st.pend[p] && !st.pend[p].subida; });
      var botones = $$('.editor__acts button', form); botones.forEach(function (b) { b.disabled = true; });
      toast('Guardando en GitHub…', 'wait', 3000);
      guardar(tipo, function (items) {
        var ya = false;
        items = items.map(function (i) { if (i.id === e.id) { ya = true; return e; } return i; });
        if (!ya) items.unshift(e);
        return items;
      }, 'Panel: ' + (e.publicado ? 'publica' : 'guarda borrador de') + ' ' + n.uno + ' "' + e.titulo + '"', rutas).then(function () {
        st.sucio = false;
        toast(e.publicado ? '¡Publicado! Puede tardar un minuto en verse en la web. <a href="' + n.pagina + encodeURIComponent(e.slug) + '" target="_blank" rel="noopener">Abrir</a>' : 'Borrador guardado. No se muestra en la web hasta que lo publiques.', 'ok', 9000);
        mostrarLista();
      }).catch(function (err) {
        botones.forEach(function (b) { b.disabled = false; });
        toast('No se pudo guardar: ' + esc(err.message) + '. Tu texto sigue aquí; inténtalo de nuevo.', 'error', 9000);
      });
    });

    function subir(multiple, base) {
      return elegirImagenes(multiple).then(function (files) {
        if (!files.length) return [];
        toast('Preparando ' + (files.length > 1 ? files.length + ' imágenes' : 'la imagen') + '…', 'wait', 2000);
        return Promise.all(files.map(function (f) { return prepararImagen(f, base).catch(function (err) { toast(esc(err.message), 'error'); return null; }); }))
          .then(function (ps) { return ps.filter(Boolean); });
      });
    }
    function pintarPortada() {
      $('#portada').innerHTML = e.portada ? '<img src="' + esc(src(e.portada)) + '" alt=""><button type="button" class="x" data-act="quitar-portada" aria-label="Quitar portada">×</button>' : '<span>Sin portada</span>';
    }
    function pintarGaleria() {
      var g = $('#galeria'); if (!g) return;
      g.innerHTML = e.galeria.map(function (p, i) { return '<span class="thumb"><img src="' + esc(src(p)) + '" alt=""><button type="button" class="x" data-act="quitar-foto" data-i="' + i + '" aria-label="Quitar foto">×</button></span>'; }).join('') || '<span class="hint">Sin fotos todavía.</span>';
    }
    function pintarMetricas() {
      var m = $('#metricas'); if (!m) return;
      m.innerHTML = e.metricas.map(function (x, i) {
        return '<div class="metric"><input type="text" data-m="valor" value="' + esc(x.valor) + '" placeholder="+700%" aria-label="Valor"><input type="text" data-m="etiqueta" value="' + esc(x.etiqueta) + '" placeholder="de retorno" aria-label="Qué mide">' +
          '<button type="button" class="x" data-act="quitar-metrica" data-i="' + i + '" aria-label="Quitar">×</button></div>';
      }).join('') || '<span class="hint">Ej. "678" · "mensajes".</span>';
    }
    function leerMetricas() {
      e.metricas = $$('#metricas .metric').map(function (row) { return { valor: $('[data-m="valor"]', row).value.trim(), etiqueta: $('[data-m="etiqueta"]', row).value.trim() }; });
    }
    function formato(area, tipoMd, entrada) {
      var a = area.selectionStart, b = area.selectionEnd, sel = area.value.slice(a, b);
      function poner(txt, ini, fin) {
        area.setRangeText(txt, a, b, 'end');
        if (ini !== undefined) area.setSelectionRange(a + ini, a + fin);
        area.focus(); st.sucio = true;
      }
      if (tipoMd === 'b') poner('**' + (sel || 'texto') + '**', 2, 2 + (sel || 'texto').length);
      else if (tipoMd === 'i') poner('*' + (sel || 'texto') + '*', 1, 1 + (sel || 'texto').length);
      else if (tipoMd === 'h') poner('\n## ' + (sel || 'Subtítulo') + '\n');
      else if (tipoMd === 'ul') poner('\n' + (sel || 'Elemento').split('\n').map(function (l) { return '- ' + l; }).join('\n') + '\n');
      else if (tipoMd === 'q') poner('\n> ' + (sel || 'Cita') + '\n');
      else if (tipoMd === 'a') { var u = prompt('Dirección del enlace (https://…)'); if (u && T.urlSegura(u)) poner('[' + (sel || 'texto del enlace') + '](' + u.trim() + ')'); else if (u) toast('El enlace debe empezar por https://', 'error'); }
      else if (tipoMd === 'yt') { var y = prompt('Enlace del video de YouTube'); if (y && T.youtubeId(y)) poner('\n' + y.trim() + '\n'); else if (y) toast('No parece un enlace de YouTube.', 'error'); }
      else if (tipoMd === 'img') subir(false, entrada.titulo || form.elements.titulo.value).then(function (ps) { if (ps[0]) poner('\n![](' + ps[0] + ')\n'); });
    }
  }

  function salirDelEditor() {
    if ($('#vista-editor').hidden || !st.sucio) return true;
    return confirm('Tienes cambios sin guardar. ¿Salir de todas formas?');
  }
  function mostrarLista() {
    st.edit = null; st.sucio = false;
    $('#vista-editor').hidden = true; $('#vista-editor').innerHTML = ''; $('#vista-lista').hidden = false;
    pintarLista(); window.scrollTo(0, 0);
  }
  window.addEventListener('beforeunload', function (e) { if (st.sucio) { e.preventDefault(); e.returnValue = ''; } });

  // ---- Arranque -------------------------------------------------------------------
  var guardada = '', recordada = false;
  try { recordada = !!localStorage.getItem(KEY); guardada = sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || ''; } catch (e) { /* nada */ }
  if (guardada) { $('#token').value = guardada; $('#recordar').checked = recordada; entrar(guardada, recordada); }
})();

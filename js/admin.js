/* Panel del equipo: publica noticias y casos de éxito.

   Los datos viven en content/noticias.json y content/casos.json y las
   imágenes (reducidas en el navegador) en content/media/.

   Hay dos formas de entrar:
   - "equipo": con la clave compartida. El panel habla con /api/panel
     (función de servidor en Vercel), que es quien publica en el repositorio.
   - "github": con una llave personal de GitHub, directamente contra la API
     de GitHub. Sirve donde no hay servidor (p. ej. GitHub Pages). */
(function () {
  'use strict';

  var T = window.Torama, esc = T.esc;
  var CFG = { owner: 'AkthamGhanam', repo: 'WebTorama', branch: 'main', publish: 'gh-pages' };
  var ROOT = 'https://api.github.com';
  var API = ROOT + '/repos/' + CFG.owner + '/' + CFG.repo;
  var RAW = 'https://raw.githubusercontent.com/' + CFG.owner + '/' + CFG.repo + '/' + CFG.branch + '/';
  var KEY = 'torama_panel_sesion', KEY_AUTOR = 'torama_panel_autor';

  var NOMBRES = { noticias: { uno: 'noticia', una: 'Nueva noticia', titulo: 'Noticiero', pagina: 'noticias.html?n=' }, casos: { uno: 'caso', una: 'Nuevo caso', titulo: 'Casos de éxito', pagina: 'casos.html?c=' } };
  var st = { modo: 'equipo', secreto: '', nombre: '', tipo: 'noticias', data: { noticias: [], casos: [] }, pend: {}, busca: '', sucio: false };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function fallo(status, msg) { var e = new Error(msg); e.status = status; return e; }

  // ---- Avisos --------------------------------------------------------------
  function toast(msg, tipo, ms) {
    var el = document.createElement('p');
    el.className = 'toast is-' + (tipo || 'ok');
    el.innerHTML = msg;
    $('#toasts').appendChild(el);
    setTimeout(function () { el.classList.add('is-out'); setTimeout(function () { el.remove(); }, 400); }, ms || 5200);
  }

  // =========================================================================
  //  Conexión por clave del equipo (servidor en Vercel)
  // =========================================================================
  function api(body) {
    return fetch('api/panel', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-team-key': st.secreto }, body: JSON.stringify(body), cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (txt) {
          var j = null; try { j = JSON.parse(txt); } catch (e) { /* no es la función del panel */ }
          if (!j || (!r.ok && !j.error)) throw fallo(0, 'sin-servidor');
          if (!r.ok) { var err = fallo(r.status, j.error); err.sinConfigurar = !!j.sinConfigurar; throw err; }
          return j;
        });
      });
  }
  var equipo = {
    entrar: function () { return api({ accion: 'entrar' }); },
    guardar: function (tipo, entrada, rutas) {
      // Las imágenes se suben de una en una y la entrada se publica al final, en un solo commit.
      var subidas = [];
      return rutas.reduce(function (p, ruta) {
        return p.then(function () { return api({ accion: 'imagen', path: ruta, b64: st.pend[ruta].b64 }); })
          .then(function (r) { subidas.push({ path: r.path, sha: r.sha }); });
      }, Promise.resolve()).then(function () {
        return api({ accion: 'guardar', tipo: tipo, entrada: entrada, imagenes: subidas });
      });
    },
    borrar: function (tipo, item) { return api({ accion: 'borrar', tipo: tipo, id: item.id, quien: st.nombre }); }
  };

  // =========================================================================
  //  Conexión directa con GitHub (llave personal)
  // =========================================================================
  function gh(url, opts) {
    opts = opts || {};
    var headers = { Authorization: 'Bearer ' + st.secreto, Accept: opts.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(url, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { var m = ''; try { m = JSON.parse(t).message; } catch (e) { m = t; } throw fallo(r.status, m || ('Error ' + r.status)); });
        return opts.raw ? r.text() : r.json();
      });
  }
  function ghLeer(tipo) {
    return gh(API + '/contents/content/' + tipo + '.json?ref=' + CFG.branch, { raw: true })
      .then(function (txt) { return JSON.parse(txt).items || []; })
      .catch(function (e) { if (e.status === 404) return []; throw e; });
  }
  function ghCommit(files, mensaje) {
    var head, baseTree;
    return gh(API + '/git/ref/heads/' + CFG.branch).then(function (ref) { head = ref.object.sha; return gh(API + '/git/commits/' + head); })
      .then(function (c) {
        baseTree = c.tree.sha;
        return Promise.all(files.map(function (f) {
          return gh(API + '/git/blobs', { method: 'POST', body: { content: f.content, encoding: f.encoding } }).then(function (b) { return { path: f.path, mode: '100644', type: 'blob', sha: b.sha }; });
        }));
      }).then(function (tree) { return gh(API + '/git/trees', { method: 'POST', body: { base_tree: baseTree, tree: tree } }); })
      .then(function (t) { return gh(API + '/git/commits', { method: 'POST', body: { message: mensaje, tree: t.sha, parents: [head] } }); })
      .then(function (nc) {
        return gh(API + '/git/refs/heads/' + CFG.branch, { method: 'PATCH', body: { sha: nc.sha } }).then(function () {
          return gh(API + '/git/refs/heads/' + CFG.publish, { method: 'PATCH', body: { sha: nc.sha, force: true } }).then(function () { return nc; }, function () { return nc; });
        });
      });
  }
  function ghCambiar(tipo, cambio, mensaje, rutas) {
    function intento(n) {
      return ghLeer(tipo).then(function (items) {
        items = cambio(items);
        var files = [{ path: 'content/' + tipo + '.json', content: JSON.stringify({ items: items }, null, 2) + '\n', encoding: 'utf-8' }];
        rutas.forEach(function (p) { files.push({ path: p, content: st.pend[p].b64, encoding: 'base64' }); });
        return ghCommit(files, mensaje).then(function () { return items; });
      }).catch(function (e) { if (n < 2 && (e.status === 422 || e.status === 409)) return intento(n + 1); throw e; });
    }
    return intento(0);
  }
  var github = {
    entrar: function () {
      return gh(ROOT + '/user').then(function () { return gh(API); }).then(function (repo) {
        if (!repo.permissions || !repo.permissions.push) throw fallo(403, 'sin-permiso');
        return Promise.all([ghLeer('noticias'), ghLeer('casos')]);
      }).then(function (r) { return { noticias: r[0], casos: r[1] }; });
    },
    guardar: function (tipo, e, rutas) {
      return ghCambiar(tipo, function (items) {
        var otros = items.filter(function (i) { return i.id !== e.id; });
        if (!e.slug) { var base = T.slug(e.titulo), s = base, k = 2; while (otros.some(function (i) { return i.slug === s; })) s = base + '-' + (k++); e.slug = s; }
        if (!e.id) e.id = e.slug + '-' + Date.now().toString(36);
        var ya = false;
        items = items.map(function (i) { if (i.id === e.id) { ya = true; return e; } return i; });
        if (!ya) items.unshift(e);
        return items;
      }, 'Panel: ' + (e.publicado ? 'publica' : 'guarda borrador de') + ' ' + NOMBRES[tipo].uno + ' "' + e.titulo + '" (' + e.autor + ')', rutas)
        .then(function (items) { return { items: items, entrada: e }; });
    },
    borrar: function (tipo, item) {
      return ghCambiar(tipo, function (items) { return items.filter(function (i) { return i.id !== item.id; }); }, 'Panel: elimina ' + NOMBRES[tipo].uno + ' "' + item.titulo + '"', [])
        .then(function (items) { return { items: items }; });
    }
  };
  function B() { return st.modo === 'github' ? github : equipo; }

  // ---- Acceso ------------------------------------------------------------------
  var form = $('#login-form'), status = $('#login-status');
  function ponerModo(modo) {
    st.modo = modo;
    var gitHub = modo === 'github';
    $('#clave-label').textContent = gitHub ? 'Llave de GitHub (token)' : 'Clave del equipo';
    $('#clave').placeholder = gitHub ? 'github_pat_…' : 'Pídesela al administrador';
    $('#login-lead').textContent = gitHub ? 'Entra con tu nombre y tu llave personal de GitHub (con permiso de escritura en WebTorama).' : 'Publica noticias y casos de éxito en la web de Torama. Entra con tu nombre y la clave del equipo.';
    $('#cambiar-modo').textContent = gitHub ? 'Entrar con la clave del equipo' : 'Entrar con una llave de GitHub';
    $('#ayuda-github').hidden = !gitHub;
  }
  $('#cambiar-modo').addEventListener('click', function () { ponerModo(st.modo === 'github' ? 'equipo' : 'github'); status.className = 'form__status'; status.textContent = ''; $('#clave').value = ''; $('#clave').focus(); });
  T.ojos(form);

  function entrar(secreto, nombre, recordar, silencioso) {
    st.secreto = secreto.trim(); st.nombre = nombre.trim();
    var boton = $('[type="submit"]', form);
    boton.disabled = true;
    status.className = 'form__status is-wait'; status.textContent = 'Comprobando…';
    return B().entrar().then(function (res) {
      st.data.noticias = res.noticias || []; st.data.casos = res.casos || [];
      try {
        var ses = JSON.stringify({ modo: st.modo, secreto: st.secreto, nombre: st.nombre });
        sessionStorage.setItem(KEY, ses);
        if (recordar) localStorage.setItem(KEY, ses); else localStorage.removeItem(KEY);
        localStorage.setItem(KEY_AUTOR, st.nombre);
      } catch (e) { /* almacenamiento bloqueado */ }
      boton.disabled = false; status.className = 'form__status'; status.textContent = '';
      $('#login').hidden = true; $('#app').hidden = false;
      $('#usuario').textContent = st.nombre;
      pintarLista();
    }).catch(function (e) {
      boton.disabled = false; st.secreto = '';
      try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (x) { /* nada */ }
      $('#login').hidden = false; $('#app').hidden = true;
      if (silencioso) { status.className = 'form__status'; status.textContent = ''; return; }
      status.className = 'form__status is-error';
      if (st.modo === 'equipo') {
        status.textContent = e.message === 'sin-servidor' ? 'La clave del equipo funciona en la versión publicada en Vercel. Desde esta dirección puedes entrar con una llave de GitHub.'
          : e.status === 401 ? 'La clave del equipo no es correcta.'
            : e.message || 'No pudimos conectar. Inténtalo de nuevo.';
      } else {
        status.textContent = e.status === 401 ? 'La llave no es válida o ha caducado.'
          : (e.status === 403 || e.status === 404) ? 'La llave no tiene permiso de escritura sobre el repositorio WebTorama.'
            : 'No pudimos conectar con GitHub. Revisa tu conexión e inténtalo de nuevo.';
      }
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!T.validar(form)) return;
    entrar($('#clave').value, $('#nombre').value, $('#recordar').checked);
  });
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
    st.tipo = b.dataset.tipo; st.busca = ''; $('#abuscar').value = ''; mostrarLista();
  });
  $('#abuscar').addEventListener('input', function () { st.busca = this.value.trim(); pintarLista(); });
  $('#nuevo').addEventListener('click', function () { editar(null); });
  $('#rows').addEventListener('click', function (e) {
    var b = e.target.closest('button'), row = e.target.closest('.row'); if (!row) return;
    var item = st.data[st.tipo].filter(function (i) { return i.id === row.dataset.id; })[0]; if (!item) return;
    if (b && b.dataset.act === 'borrar') return borrar(item);
    editar(item);
  });

  function errorDe(e) { return e.status === 401 ? 'La sesión ya no es válida. Sal y vuelve a entrar.' : esc(e.message || 'Error de conexión'); }

  function borrar(item) {
    if (!confirm('¿Eliminar "' + item.titulo + '"? Esta acción no se puede deshacer desde el panel.')) return;
    var tipo = st.tipo;
    toast('Eliminando…', 'wait', 2500);
    B().borrar(tipo, item).then(function (r) { st.data[tipo] = r.items; toast('Entrada eliminada.'); mostrarLista(); })
      .catch(function (e) { toast('No se pudo eliminar: ' + errorDe(e), 'error'); });
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
          var ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
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
  function campo(label, control, cls) { return '<label class="field ' + (cls || '') + '">' + control + '<span>' + label + '</span></label>'; }
  function opcionesCat(v) {
    return Object.keys(T.CATEGORIAS).map(function (k) { return '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(T.CATEGORIAS[k]) + '</option>'; }).join('');
  }

  function editar(item) {
    var esNuevo = !item, tipo = st.tipo, n = NOMBRES[tipo];
    var e = item ? JSON.parse(JSON.stringify(item)) : { id: '', slug: '', titulo: '', autor: st.nombre, fecha: hoy(), publicado: true, destacado: false, cuerpo: '', portada: '', galeria: [], metricas: [], categoria: tipo === 'casos' ? 'meta-ads' : '' };
    e.galeria = e.galeria || []; e.metricas = e.metricas || [];
    st.sucio = false;
    var cats = []; st.data.noticias.forEach(function (x) { if (x.categoria && cats.indexOf(x.categoria) < 0) cats.push(x.categoria); });

    var html = '<form class="editor form" id="editor" novalidate>' +
      '<div class="editor__top"><button type="button" class="back" data-act="volver">← Volver</button><h1 class="title">' + (esNuevo ? n.una : 'Editar ' + n.uno) + '</h1></div>' +
      '<div class="editor__cols"><div class="editor__main">' +
      campo('Título', '<input type="text" name="titulo" value="' + esc(e.titulo) + '" required maxlength="140" placeholder="Un título claro y corto">', 'field--title');
    if (tipo === 'casos') {
      html += '<div class="form__row">' + campo('Cliente o marca', '<input type="text" name="cliente" value="' + esc(e.cliente || '') + '" placeholder="Nombre del cliente">') +
        campo('Servicio', '<select name="categoria">' + opcionesCat(e.categoria) + '</select>', 'field--up') + '</div>' +
        campo('Resumen', '<textarea name="resumen" rows="2" placeholder="Una frase con el resultado principal">' + esc(e.resumen || '') + '</textarea>', 'field--short') +
        '<fieldset class="box"><legend>Resultados en números <small>(opcional)</small></legend><div id="metricas"></div><button type="button" class="mini" data-act="mas-metrica">+ Añadir resultado</button></fieldset>';
    } else {
      html += campo('Extracto', '<textarea name="extracto" rows="2" placeholder="Una o dos frases que resumen la noticia">' + esc(e.extracto || '') + '</textarea>', 'field--short');
    }
    html += '<div class="mdbox"><div class="mdbar" role="toolbar" aria-label="Formato">' +
      '<span class="mdbar__label">Contenido</span>' +
      '<button type="button" data-md="b" title="Negrita"><b>N</b></button><button type="button" data-md="i" title="Cursiva"><i>C</i></button>' +
      '<button type="button" data-md="h" title="Subtítulo">Subtítulo</button><button type="button" data-md="ul" title="Lista">Lista</button>' +
      '<button type="button" data-md="q" title="Cita">Cita</button><button type="button" data-md="a" title="Enlace">Enlace</button>' +
      '<button type="button" data-md="img" title="Insertar imagen">Imagen</button><button type="button" data-md="yt" title="Video de YouTube">Video</button>' +
      '<button type="button" class="mdbar__prev" data-act="preview">Vista previa</button></div>' +
      '<textarea name="cuerpo" rows="14" placeholder="Escribe aquí…" aria-label="Contenido">' + esc(e.cuerpo || '') + '</textarea>' +
      '<div class="prose prose--post mdprev" id="mdprev" hidden></div></div>';
    if (tipo === 'casos') {
      html += '<fieldset class="box"><legend>Galería</legend><div class="thumbs" id="galeria"></div><button type="button" class="mini" data-act="mas-fotos">+ Añadir fotos</button></fieldset>' +
        campo('Video <small>(enlace, opcional)</small>', '<input type="url" name="video" value="' + esc(e.video || '') + '" placeholder="https://youtube.com/…">');
    }
    html += '</div><aside class="editor__side">' +
      '<fieldset class="box"><legend>Portada</legend><div class="cover" id="portada"></div><button type="button" class="mini" data-act="portada">Subir imagen</button></fieldset>' +
      campo('Creado por', '<input type="text" name="autor" value="' + esc(e.autor || '') + '" required placeholder="Nombre de quien firma">') +
      (tipo === 'noticias' ? campo('Cargo o rol <small>(opcional)</small>', '<input type="text" name="cargo" value="' + esc(e.cargo || '') + '" placeholder="Ej. Community Manager">') +
        campo('Categoría', '<input type="text" name="categoria" value="' + esc(e.categoria || '') + '" list="cats" placeholder="Ej. Equipo, Campañas…"><datalist id="cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist>') : '') +
      campo('Fecha', '<input type="date" name="fecha" value="' + esc(e.fecha || hoy()) + '">', 'field--up') +
      '<label class="switch"><input type="checkbox" name="destacado"' + (e.destacado ? ' checked' : '') + '><i></i><span>Destacar</span></label>' +
      '<p class="editor__state">Estado actual: <b>' + (esNuevo ? 'sin guardar' : (e.publicado !== false ? 'publicado' : 'borrador')) + '</b></p>' +
      '<div class="editor__acts"><button class="btn btn--red" type="submit" data-pub="1">Publicar</button><button class="btn btn--glass" type="submit" data-pub="0">Guardar borrador</button></div>' +
      (esNuevo ? '' : '<button type="button" class="mini danger" data-act="eliminar">Eliminar ' + n.uno + '</button>') +
      '</aside></div></form>';

    var view = $('#vista-editor');
    view.innerHTML = html; view.hidden = false; $('#vista-lista').hidden = true;
    window.scrollTo(0, 0);
    pintarPortada(); pintarGaleria(); pintarMetricas();
    var ed = $('#editor'), ta = ed.elements.cuerpo, pubFlag = '1';

    ed.addEventListener('input', function () { st.sucio = true; });
    ed.addEventListener('click', function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      if (b.dataset.pub) { pubFlag = b.dataset.pub; return; }
      var act = b.dataset.act, md = b.dataset.md;
      if (md) return formato(md);
      if (act === 'volver') { if (salirDelEditor()) mostrarLista(); }
      else if (act === 'preview') {
        var prev = $('#mdprev'), on = prev.hidden;
        if (on) prev.innerHTML = T.md(ta.value, src) || '<p><em>Sin contenido todavía.</em></p>';
        prev.hidden = !on; ta.hidden = on; b.textContent = on ? 'Seguir editando' : 'Vista previa';
      }
      else if (act === 'portada') subir(false).then(function (ps) { if (ps[0]) { e.portada = ps[0]; st.sucio = true; pintarPortada(); } });
      else if (act === 'quitar-portada') { e.portada = ''; st.sucio = true; pintarPortada(); }
      else if (act === 'mas-fotos') subir(true).then(function (ps) { e.galeria = e.galeria.concat(ps); st.sucio = true; pintarGaleria(); });
      else if (act === 'quitar-foto') { e.galeria.splice(parseInt(b.dataset.i, 10), 1); st.sucio = true; pintarGaleria(); }
      else if (act === 'mas-metrica') { leerMetricas(); e.metricas.push({ valor: '', etiqueta: '' }); pintarMetricas(); }
      else if (act === 'quitar-metrica') { leerMetricas(); e.metricas.splice(parseInt(b.dataset.i, 10), 1); st.sucio = true; pintarMetricas(); }
      else if (act === 'eliminar') borrar(item);
    });

    ed.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (!T.validar(ed)) return;
      ['titulo', 'cliente', 'categoria', 'resumen', 'extracto', 'cuerpo', 'video', 'autor', 'cargo', 'fecha'].forEach(function (k) { if (ed.elements[k]) e[k] = ed.elements[k].value.trim(); });
      e.destacado = ed.elements.destacado.checked;
      e.publicado = pubFlag === '1';
      if (tipo === 'casos') { leerMetricas(); e.metricas = e.metricas.filter(function (m) { return m.valor || m.etiqueta; }); } else { delete e.galeria; delete e.metricas; }

      var rutas = [e.portada].concat(e.galeria || []).concat((e.cuerpo.match(/content\/media\/[\w\-./]+/g) || []))
        .filter(function (p, i, a) { return p && st.pend[p] && !st.pend[p].subida && a.indexOf(p) === i; });
      var botones = $$('.editor__acts button', ed); botones.forEach(function (b) { b.disabled = true; });
      toast(rutas.length ? 'Subiendo ' + (rutas.length > 1 ? rutas.length + ' imágenes' : 'la imagen') + ' y guardando…' : 'Guardando…', 'wait', 3500);
      B().guardar(tipo, e, rutas).then(function (r) {
        st.data[tipo] = r.items; rutas.forEach(function (p) { st.pend[p].subida = true; });
        st.sucio = false;
        var g = r.entrada || e;
        toast(g.publicado ? '¡Publicado! Puede tardar un minuto en verse en la web. <a href="' + n.pagina + encodeURIComponent(g.slug) + '" target="_blank" rel="noopener">Abrir</a>' : 'Borrador guardado. No se muestra en la web hasta que lo publiques.', 'ok', 9000);
        mostrarLista();
      }).catch(function (err) {
        botones.forEach(function (b) { b.disabled = false; });
        toast('No se pudo guardar: ' + errorDe(err) + ' Tu texto sigue aquí.', 'error', 9000);
      });
    });

    function subir(multiple) {
      return elegirImagenes(multiple).then(function (files) {
        if (!files.length) return [];
        toast('Preparando ' + (files.length > 1 ? files.length + ' imágenes' : 'la imagen') + '…', 'wait', 2000);
        return Promise.all(files.map(function (f) { return prepararImagen(f, ed.elements.titulo.value).catch(function (err) { toast(esc(err.message), 'error'); return null; }); }))
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
    function formato(tipoMd) {
      var a = ta.selectionStart, b = ta.selectionEnd, sel = ta.value.slice(a, b);
      function poner(txt, ini, fin) {
        ta.setRangeText(txt, a, b, 'end');
        if (ini !== undefined) ta.setSelectionRange(a + ini, a + fin);
        ta.focus(); st.sucio = true;
      }
      if (tipoMd === 'b') poner('**' + (sel || 'texto') + '**', 2, 2 + (sel || 'texto').length);
      else if (tipoMd === 'i') poner('*' + (sel || 'texto') + '*', 1, 1 + (sel || 'texto').length);
      else if (tipoMd === 'h') poner('\n## ' + (sel || 'Subtítulo') + '\n');
      else if (tipoMd === 'ul') poner('\n' + (sel || 'Elemento').split('\n').map(function (l) { return '- ' + l; }).join('\n') + '\n');
      else if (tipoMd === 'q') poner('\n> ' + (sel || 'Cita') + '\n');
      else if (tipoMd === 'a') { var u = prompt('Dirección del enlace (https://…)'); if (u && T.urlSegura(u)) poner('[' + (sel || 'texto del enlace') + '](' + u.trim() + ')'); else if (u) toast('El enlace debe empezar por https://', 'error'); }
      else if (tipoMd === 'yt') { var y = prompt('Enlace del video de YouTube'); if (y && T.youtubeId(y)) poner('\n' + y.trim() + '\n'); else if (y) toast('No parece un enlace de YouTube.', 'error'); }
      else if (tipoMd === 'img') subir(false).then(function (ps) { if (ps[0]) poner('\n![](' + ps[0] + ')\n'); });
    }
  }

  function salirDelEditor() {
    if ($('#vista-editor').hidden || !st.sucio) return true;
    return confirm('Tienes cambios sin guardar. ¿Salir de todas formas?');
  }
  function mostrarLista() {
    st.sucio = false;
    $('#vista-editor').hidden = true; $('#vista-editor').innerHTML = ''; $('#vista-lista').hidden = false;
    pintarLista(); window.scrollTo(0, 0);
  }
  window.addEventListener('beforeunload', function (e) { if (st.sucio) { e.preventDefault(); e.returnValue = ''; } });

  // ---- Arranque -------------------------------------------------------------------
  var ses = null, recordada = false;
  try {
    recordada = !!localStorage.getItem(KEY);
    ses = JSON.parse(sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || 'null');
    $('#nombre').value = (ses && ses.nombre) || localStorage.getItem(KEY_AUTOR) || '';
  } catch (e) { /* nada */ }
  ponerModo(ses && ses.modo === 'github' ? 'github' : 'equipo');
  if (ses && ses.secreto && ses.nombre) { $('#recordar').checked = recordada; entrar(ses.secreto, ses.nombre, recordada, true); }
})();

/* Función de servidor (Vercel) del panel del equipo.

   El equipo entra con una clave compartida. Esta función comprueba la clave y
   publica en el repositorio de GitHub usando un token que solo vive en el
   servidor, de modo que nadie del equipo necesita cuenta ni llave de GitHub.

   Variables de entorno (Vercel → Settings → Environment Variables):
     TEAM_KEY        Clave del equipo (la que se escribe en el panel).
     GITHUB_TOKEN    Token de GitHub con permiso "Contents: Read and write"
                     sobre el repositorio del sitio.
     GITHUB_REPO     Opcional. Por defecto "AkthamGhanam/WebTorama".
     GITHUB_BRANCH   Opcional. Por defecto "main".
     PUBLISH_BRANCH  Opcional. Rama extra que se pone al día tras cada
                     publicación (p. ej. "gh-pages"). Vacío = ninguna.        */

const crypto = require('crypto');

const REPO = process.env.GITHUB_REPO || 'AkthamGhanam/WebTorama';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const PUBLISH = process.env.PUBLISH_BRANCH === undefined ? 'gh-pages' : process.env.PUBLISH_BRANCH;
const API = 'https://api.github.com/repos/' + REPO;
const TIPOS = { noticias: 'entrada del blog', casos: 'caso' };
const CATEGORIAS = ['meta-ads', 'audiovisual', 'contenido', 'ia', 'fotografia', 'diseno', 'auditoria', 'formaciones'];
const RUTA_MEDIA = /^content\/media\/(noticias|casos)\/[a-z0-9][a-z0-9-]{0,80}\.(webp|jpg|jpeg|png)$/;
const MAX_IMAGEN = 3.5 * 1024 * 1024;        // en base64

class Fallo extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function responder(res, status, datos) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(datos));
}

function leerCuerpo(req) {
  if (req.body !== undefined) return Promise.resolve(typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}));
  return new Promise((ok, mal) => {
    let txt = '';
    req.on('data', (c) => { txt += c; if (txt.length > 6e6) { mal(new Fallo(413, 'Demasiado grande')); req.destroy(); } });
    req.on('end', () => { try { ok(JSON.parse(txt || '{}')); } catch (e) { mal(new Fallo(400, 'Petición no válida')); } });
    req.on('error', mal);
  });
}

function claveCorrecta(dada) {
  const buena = process.env.TEAM_KEY || '';
  if (!buena || typeof dada !== 'string') return false;
  const a = crypto.createHash('sha256').update(dada).digest();
  const b = crypto.createHash('sha256').update(buena).digest();
  return crypto.timingSafeEqual(a, b);
}

async function gh(ruta, opts = {}) {
  const r = await fetch(API + ruta, {
    method: opts.method || 'GET',
    headers: {
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      Accept: opts.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'torama-panel',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!r.ok) {
    const e = new Fallo(r.status === 404 ? 404 : r.status === 422 || r.status === 409 ? 409 : 502, 'GitHub respondió ' + r.status);
    e.github = r.status;
    throw e;
  }
  return opts.raw ? r.text() : r.json();
}

async function leer(tipo) {
  try { return JSON.parse(await gh('/contents/content/' + tipo + '.json?ref=' + BRANCH, { raw: true })).items || []; }
  catch (e) { if (e.status === 404) return []; throw e; }
}

function slug(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'entrada';
}
function texto(v, max) { return String(v == null ? '' : v).replace(/\u0000/g, '').trim().slice(0, max); }
function rutaSegura(u) {
  u = texto(u, 400);
  if (!u) return '';
  if (/^https:\/\/[^\s<>"']+$/i.test(u)) return u;
  if (/^(content|assets)\/[\w\-./%]+$/.test(u) && !u.includes('..')) return u;
  return '';
}

/* Solo se guardan los campos conocidos, con su tipo y un tamaño razonable. */
function limpiar(tipo, e) {
  if (!e || typeof e !== 'object') throw new Fallo(400, 'Falta la entrada');
  const titulo = texto(e.titulo, 140), autor = texto(e.autor, 80);
  if (!titulo) throw new Fallo(400, 'Falta el título');
  if (!autor) throw new Fallo(400, 'Falta "Creado por"');
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(e.fecha || '') ? e.fecha : new Date().toISOString().slice(0, 10);
  const base = {
    id: /^[a-z0-9-]{1,120}$/.test(e.id || '') ? e.id : '',
    slug: /^[a-z0-9-]{1,90}$/.test(e.slug || '') ? e.slug : '',
    titulo, autor, fecha,
    cuerpo: texto(e.cuerpo, 60000),
    portada: rutaSegura(e.portada),
    destacado: !!e.destacado,
    publicado: e.publicado !== false
  };
  if (tipo === 'noticias') {
    return { ...base, extracto: texto(e.extracto, 400), categoria: texto(e.categoria, 40), cargo: texto(e.cargo, 80) };
  }
  return {
    ...base,
    cliente: texto(e.cliente, 120),
    categoria: CATEGORIAS.includes(e.categoria) ? e.categoria : 'meta-ads',
    resumen: texto(e.resumen, 400),
    video: rutaSegura(e.video),
    galeria: (Array.isArray(e.galeria) ? e.galeria : []).map(rutaSegura).filter(Boolean).slice(0, 40),
    metricas: (Array.isArray(e.metricas) ? e.metricas : []).map((m) => ({ valor: texto(m && m.valor, 24), etiqueta: texto(m && m.etiqueta, 60) }))
      .filter((m) => m.valor || m.etiqueta).slice(0, 8)
  };
}

async function publicar(archivos, mensaje) {
  const ref = await gh('/git/ref/heads/' + BRANCH);
  const head = ref.object.sha;
  const base = (await gh('/git/commits/' + head)).tree.sha;
  const tree = await gh('/git/trees', { method: 'POST', body: { base_tree: base, tree: archivos } });
  const nuevo = await gh('/git/commits', { method: 'POST', body: { message: mensaje, tree: tree.sha, parents: [head] } });
  await gh('/git/refs/heads/' + BRANCH, { method: 'PATCH', body: { sha: nuevo.sha } });
  if (PUBLISH && PUBLISH !== BRANCH) {
    try { await gh('/git/refs/heads/' + PUBLISH, { method: 'PATCH', body: { sha: nuevo.sha, force: true } }); } catch (e) { /* esa rama es opcional */ }
  }
}

/* Lee la última versión, aplica el cambio y publica. Si alguien publicó a la
   vez, se reintenta sobre la versión nueva. */
async function guardar(tipo, cambio, mensaje, imagenes) {
  for (let intento = 0; ; intento++) {
    const items = cambio(await leer(tipo));
    const datos = await gh('/git/blobs', { method: 'POST', body: { content: JSON.stringify({ items }, null, 2) + '\n', encoding: 'utf-8' } });
    const archivos = [{ path: 'content/' + tipo + '.json', mode: '100644', type: 'blob', sha: datos.sha }]
      .concat(imagenes.map((i) => ({ path: i.path, mode: '100644', type: 'blob', sha: i.sha })));
    try { await publicar(archivos, mensaje); return items; }
    catch (e) { if (e.status !== 409 || intento >= 2) throw e; }
  }
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return responder(res, 405, { error: 'Método no permitido' });
    if (!process.env.TEAM_KEY || !process.env.GITHUB_TOKEN) {
      return responder(res, 503, { error: 'El panel no está configurado: faltan TEAM_KEY o GITHUB_TOKEN en Vercel.', sinConfigurar: true });
    }
    const body = await leerCuerpo(req);
    if (!claveCorrecta(req.headers['x-team-key'])) {
      await new Promise((r) => setTimeout(r, 700));      // frena los intentos a ciegas
      return responder(res, 401, { error: 'La clave del equipo no es correcta.' });
    }

    const tipo = body.tipo;
    switch (body.accion) {
      case 'entrar':
      case 'leer': {
        const [noticias, casos] = await Promise.all([leer('noticias'), leer('casos')]);
        return responder(res, 200, { ok: true, noticias, casos });
      }
      case 'imagen': {
        if (!RUTA_MEDIA.test(body.path || '')) throw new Fallo(400, 'Ruta de imagen no válida');
        if (typeof body.b64 !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(body.b64) || body.b64.length > MAX_IMAGEN) throw new Fallo(400, 'Imagen no válida o demasiado grande');
        const blob = await gh('/git/blobs', { method: 'POST', body: { content: body.b64, encoding: 'base64' } });
        return responder(res, 200, { ok: true, path: body.path, sha: blob.sha });
      }
      case 'guardar': {
        if (!TIPOS[tipo]) throw new Fallo(400, 'Tipo no válido');
        const e = limpiar(tipo, body.entrada);
        const imagenes = (Array.isArray(body.imagenes) ? body.imagenes : []).slice(0, 60).map((i) => {
          if (!i || !RUTA_MEDIA.test(i.path || '') || !/^[0-9a-f]{40}$/.test(i.sha || '')) throw new Fallo(400, 'Imagen no válida');
          return { path: i.path, sha: i.sha };
        });
        const items = await guardar(tipo, (lista) => {
          const otros = lista.filter((x) => x.id !== e.id);
          if (!e.slug) {
            const b = slug(e.titulo); let s = b, k = 2;
            while (otros.some((x) => x.slug === s)) s = b + '-' + (k++);
            e.slug = s;
          }
          if (!e.id) e.id = e.slug + '-' + Date.now().toString(36);
          let ya = false;
          const nueva = lista.map((x) => { if (x.id === e.id) { ya = true; return e; } return x; });
          if (!ya) nueva.unshift(e);
          return nueva;
        }, 'Panel: ' + (e.publicado ? 'publica' : 'guarda borrador de') + ' ' + TIPOS[tipo] + ' "' + e.titulo + '" (' + e.autor + ')', imagenes);
        return responder(res, 200, { ok: true, items, entrada: e });
      }
      case 'borrar': {
        if (!TIPOS[tipo]) throw new Fallo(400, 'Tipo no válido');
        const id = texto(body.id, 120);
        if (!id) throw new Fallo(400, 'Falta el identificador');
        const items = await guardar(tipo, (lista) => lista.filter((x) => x.id !== id), 'Panel: elimina ' + TIPOS[tipo] + ' ' + id + (body.quien ? ' (' + texto(body.quien, 80) + ')' : ''), []);
        return responder(res, 200, { ok: true, items });
      }
      default:
        throw new Fallo(400, 'Acción no válida');
    }
  } catch (e) {
    const status = e instanceof Fallo ? e.status : 500;
    const msg = e instanceof Fallo && !e.github ? e.message
      : e.github === 401 || e.github === 403 ? 'El token de GitHub del servidor no es válido o no tiene permiso de escritura.'
        : status === 409 ? 'Otra persona publicó al mismo tiempo. Vuelve a intentarlo.'
          : 'No se pudo completar la operación. Inténtalo de nuevo.';
    return responder(res, status, { error: msg });
  }
};

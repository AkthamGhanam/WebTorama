/* Mapa del sitio y robots.txt para buscadores (función de servidor en Vercel).

   /sitemap.xml y /robots.txt llegan aquí por las reglas de vercel.json.
   El mapa se genera al momento con las páginas fijas y con cada noticia y
   caso de éxito publicados, usando el dominio desde el que se pide, así que
   no hay que tocarlo al cambiar de dominio ni al publicar contenido nuevo. */

const PAGINAS = [
  { ruta: '', prioridad: '1.0', frecuencia: 'weekly' },
  { ruta: 'casos.html', prioridad: '0.9', frecuencia: 'weekly' },
  { ruta: 'noticias.html', prioridad: '0.9', frecuencia: 'daily' },
  { ruta: 'privacidad.html', prioridad: '0.3', frecuencia: 'yearly' }
];

function xml(s) { return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])); }

async function items(base, tipo) {
  try {
    const r = await fetch(base + 'content/' + tipo + '.json');
    if (!r.ok) return [];
    return ((await r.json()).items || []).filter((i) => i && i.publicado !== false && /^[a-z0-9-]+$/.test(i.slug || ''));
  } catch (e) { return []; }
}

module.exports = async function handler(req, res) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').replace(/[^a-zA-Z0-9.:-]/g, '');
  const base = 'https://' + host + '/';
  const que = /robots/.test(req.url || '') ? 'robots' : 'sitemap';

  if (que === 'robots') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.end('User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ' + base + 'sitemap.xml\n');
  }

  const [noticias, casos] = await Promise.all([items(base, 'noticias'), items(base, 'casos')]);
  const fecha = (f) => (/^\d{4}-\d{2}-\d{2}$/.test(f || '') ? '<lastmod>' + f + '</lastmod>' : '');
  const urls = PAGINAS.map((p) => '<url><loc>' + xml(base + p.ruta) + '</loc><changefreq>' + p.frecuencia + '</changefreq><priority>' + p.prioridad + '</priority></url>')
    .concat(noticias.map((n) => '<url><loc>' + xml(base + 'noticias.html?n=' + n.slug) + '</loc>' + fecha(n.fecha) + '<priority>0.7</priority></url>'))
    .concat(casos.map((c) => '<url><loc>' + xml(base + 'casos.html?c=' + c.slug) + '</loc>' + fecha(c.fecha) + '<priority>0.7</priority></url>'));

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=600');
  res.end('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n');
};

/* Función de servidor (Vercel) que recibe los formularios de la web y los
   entrega por correo.

   El navegador del visitante solo habla con el propio dominio de la web
   (/api/contacto). Desde aquí el mensaje sale por una de estas dos vías:

   1. Gmail (recomendada): si existen GMAIL_USER y GMAIL_APP_PASSWORD, el
      correo se envía con esa cuenta por SMTP. No necesita activación.
   2. FormSubmit (respaldo): si no hay credenciales de Gmail, se reenvía a
      FormSubmit desde el servidor. La primera vez FormSubmit manda un correo
      de activación al buzón de destino que hay que confirmar una sola vez.

   Variables de entorno (Vercel → Settings → Environment Variables):
     CONTACT_TO          Buzón que recibe los formularios.
     GMAIL_USER          Opcional. Cuenta de Gmail que envía (p. ej. la misma
                         del buzón de destino).
     GMAIL_APP_PASSWORD  Opcional. "Contraseña de aplicación" de esa cuenta
                         (Cuenta de Google → Seguridad → Contraseñas de
                         aplicaciones; requiere verificación en dos pasos).
     SITE_URL            Opcional. Dirección pública de la web, usada con
                         FormSubmit. Por defecto https://toramaagency.com      */

// TEMPORAL: buzón de prueba mientras se activa el formulario. Para recibir en
// el buzón definitivo, define CONTACT_TO = Contenido.toramaagency@gmail.com en
// Vercel (o cambia este valor).
const DESTINO = (process.env.CONTACT_TO || 'ghanamaktham@gmail.com').trim();
const SITIO = (process.env.SITE_URL || 'https://toramaagency.com').replace(/\/+$/, '');
const DOMINIOS = ['toramaagency.com', 'www.toramaagency.com', 'webtorama.vercel.app'];
const CORREO = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;
const MAX_CAMPOS = 20;
const MAX_VALOR = 5000;
const LIMITE = { ventana: 10 * 60 * 1000, envios: 5 };
const vistos = new Map();                 // IP → marcas de tiempo (por instancia)

class Fallo extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra || {}; } }

function responder(res, status, datos) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(datos));
}

function leerCuerpo(req) {
  if (req.body !== undefined) {
    if (typeof req.body === 'string') { try { return Promise.resolve(JSON.parse(req.body || '{}')); } catch (e) { return Promise.reject(new Fallo(400, 'Petición no válida')); } }
    return Promise.resolve(req.body || {});
  }
  return new Promise((ok, mal) => {
    let txt = '';
    req.on('data', (c) => { txt += c; if (txt.length > 200000) { mal(new Fallo(413, 'Demasiado grande')); req.destroy(); } });
    req.on('end', () => { try { ok(JSON.parse(txt || '{}')); } catch (e) { mal(new Fallo(400, 'Petición no válida')); } });
    req.on('error', mal);
  });
}

/* Solo se aceptan envíos hechos desde la propia web. */
function origenPermitido(req) {
  const origen = req.headers.origin || req.headers.referer || '';
  if (!origen) return false;
  let host;
  try { host = new URL(origen).host.toLowerCase(); } catch (e) { return false; }
  const propio = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  return host === propio || DOMINIOS.indexOf(host) >= 0 || /^webtorama-[a-z0-9-]+\.vercel\.app$/.test(host)
    || /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
}

function demasiados(ip) {
  const ahora = Date.now();
  const lista = (vistos.get(ip) || []).filter((t) => ahora - t < LIMITE.ventana);
  lista.push(ahora);
  vistos.set(ip, lista);
  if (vistos.size > 5000) vistos.clear();
  return lista.length > LIMITE.envios;
}

function linea(s, max) { return String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max); }
function html(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function limpiar(d) {
  if (d._honey) throw new Fallo(200, 'ok', { ok: true });          // trampa para bots: se ignora en silencio
  const campos = (Array.isArray(d.campos) ? d.campos : []).slice(0, MAX_CAMPOS)
    .map((c) => Array.isArray(c) ? [linea(c[0], 80), String(c[1] == null ? '' : c[1]).trim().slice(0, MAX_VALOR)] : null)
    .filter((c) => c && c[0] && c[1]);
  if (!campos.length) throw new Fallo(400, 'El formulario llegó vacío.');
  const email = linea(d.email, 200);
  if (email && !CORREO.test(email)) throw new Fallo(400, 'El correo no es válido.');
  const asunto = linea(d.asunto, 150) || 'Mensaje desde la web de Torama';
  return { asunto, email, campos };
}

async function porGmail(m) {
  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.GMAIL_USER, pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '') }
  });
  const texto = m.campos.map((c) => c[0] + ': ' + c[1]).join('\n') + '\n\n— Enviado desde ' + SITIO;
  const tabla = '<table cellpadding="8" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">'
    + m.campos.map((c) => '<tr><th align="left" valign="top" style="background:#12283f;color:#fff;white-space:nowrap">' + html(c[0])
      + '</th><td style="border-bottom:1px solid #e5e7eb">' + html(c[1]).replace(/\n/g, '<br>') + '</td></tr>').join('')
    + '</table><p style="font-family:Arial,sans-serif;font-size:12px;color:#6b7280">Enviado desde ' + html(SITIO) + '</p>';
  await t.sendMail({
    from: { name: 'Web Torama', address: process.env.GMAIL_USER },
    to: DESTINO,
    replyTo: m.email || undefined,
    subject: m.asunto,
    text: texto,
    html: tabla
  });
  return { ok: true, via: 'gmail' };
}

async function porFormSubmit(m) {
  const datos = {};
  m.campos.forEach((c) => { datos[c[0]] = c[1]; });
  if (m.email) datos.email = m.email;
  datos._subject = m.asunto;
  datos._template = 'table';
  datos._captcha = 'false';
  let r, j = {};
  try {
    r = await fetch('https://formsubmit.co/ajax/' + encodeURIComponent(DESTINO), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: SITIO, Referer: SITIO + '/' },
      body: JSON.stringify(datos),
      signal: AbortSignal.timeout(15000)
    });
    j = await r.json().catch(() => ({}));
  } catch (e) {
    throw new Fallo(502, 'No se pudo contactar con el servicio de correo.');
  }
  if (r.ok && String(j.success) === 'true') return { ok: true, via: 'formsubmit' };
  if (/activ/i.test(String(j.message || ''))) {
    throw new Fallo(503, 'El formulario está pendiente de activación.', { activacion: true });
  }
  throw new Fallo(502, 'El servicio de correo rechazó el envío.', { detalle: linea(j.message || ('HTTP ' + r.status), 200) });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return responder(res, 405, { ok: false, error: 'Método no permitido' });
    if (!origenPermitido(req)) return responder(res, 403, { ok: false, error: 'Origen no permitido' });
    const ip = String(req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || '').split(',')[0].trim();
    if (demasiados(ip)) return responder(res, 429, { ok: false, error: 'Demasiados envíos seguidos. Prueba en unos minutos.' });
    const m = limpiar(await leerCuerpo(req));
    const gmail = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD;
    return responder(res, 200, gmail ? await porGmail(m) : await porFormSubmit(m));
  } catch (e) {
    if (e instanceof Fallo) return responder(res, e.status, Object.assign({ ok: e.status === 200, error: e.status === 200 ? undefined : e.message }, e.extra));
    console.error('contacto:', e && e.message);
    return responder(res, 502, { ok: false, error: 'No se pudo enviar el correo.' });
  }
};

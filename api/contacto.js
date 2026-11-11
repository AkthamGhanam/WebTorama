/* Función de servidor (Vercel) que recibe los formularios de la web y los
   entrega por correo con una cuenta de Gmail.

   El navegador del visitante solo habla con el propio dominio de la web
   (/api/contacto), así que funciona desde cualquier red. El correo sale por
   SMTP con la cuenta de GMAIL_USER, sin servicios intermedios ni correos de
   activación. "Responder" en el correo contesta directamente al visitante.

   Variables de entorno (Vercel → Settings → Environment Variables):
     GMAIL_USER          Cuenta de Gmail que envía los formularios.
     GMAIL_APP_PASSWORD  "Contraseña de aplicación" de esa cuenta (Cuenta de
                         Google → Seguridad → Verificación en dos pasos →
                         Contraseñas de aplicaciones).
     CONTACT_TO          Opcional. Buzón que recibe los formularios. Por
                         defecto, el mismo GMAIL_USER.
     SITE_URL            Opcional. Dirección pública de la web, para el pie del
                         correo. Por defecto https://toramaagency.com

   Sin GMAIL_USER/GMAIL_APP_PASSWORD responde 503 { sinCorreo: true } y el
   navegador prueba a enviar directo a FormSubmit como respaldo.             */

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

const TIPOS = ['linea', 'email', 'tel', 'url', 'opciones', 'texto'];

function limpiar(d) {
  if (d._honey) throw new Fallo(200, 'ok', { ok: true });          // trampa para bots: se ignora en silencio
  const campos = (Array.isArray(d.campos) ? d.campos : []).slice(0, MAX_CAMPOS)
    .map((c) => {
      if (!Array.isArray(c)) return null;
      const tipo = TIPOS.indexOf(c[2]) >= 0 ? c[2] : 'linea';
      const valor = String(c[1] == null ? '' : c[1]).trim().slice(0, MAX_VALOR);
      return [linea(c[0], 80), tipo === 'texto' ? valor : linea(valor, 1000), tipo];
    })
    .filter((c) => c && c[0] && (c[1] || c[2] === 'opciones'));    // las opciones se muestran aunque no marque ninguna
  if (!campos.some((c) => c[1])) throw new Fallo(400, 'El formulario llegó vacío.');
  const email = linea(d.email, 200);
  if (email && !CORREO.test(email)) throw new Fallo(400, 'El correo no es válido.');
  const asunto = linea(d.asunto, 150) || 'Mensaje desde la web de Torama';
  return { asunto, email, campos };
}

/* ---------- Correo con el diseño de Torama ---------- */

const C = { marino: '#12283f', verde: '#78ffc0', coral: '#e6414c', fondo: '#eef1f5', texto: '#1f2937', suave: '#6b7280', linea: '#e5e7eb' };
const FUENTE = "font-family:Poppins,'Segoe UI',Helvetica,Arial,sans-serif;";

function whatsapp(tel) {
  const crudo = String(tel).trim();
  let d = crudo.replace(/\D/g, '');
  if (!crudo.startsWith('+')) {
    if (d.length === 11 && d[0] === '0') d = '58' + d.slice(1);         // 0412… → 58412…
    else if (d.length === 10 && d[0] === '4') d = '58' + d;             // 412…  → 58412…
  }
  return d.length >= 8 ? 'https://wa.me/' + d : '';
}

function fecha() {
  try {
    return new Intl.DateTimeFormat('es-VE', { timeZone: 'America/Caracas', dateStyle: 'full', timeStyle: 'short' }).format(new Date()) + ' (hora de Venezuela)';
  } catch (e) { return new Date().toISOString(); }
}

function valorHtml(c) {
  const v = html(c[1]);
  if (c[2] === 'email' && CORREO.test(c[1])) return '<a href="mailto:' + v + '" style="color:' + C.marino + ';font-weight:600">' + v + '</a>';
  if (c[2] === 'tel' && whatsapp(c[1])) return '<a href="' + whatsapp(c[1]) + '" style="color:' + C.marino + ';font-weight:600">' + v + '</a>';
  if (c[2] === 'url' && /^https?:\/\//i.test(c[1])) return '<a href="' + v + '" style="color:' + C.marino + ';font-weight:600;word-break:break-all">' + v + '</a>';
  return v;
}

function titulo(txt) {
  return '<p style="margin:0 0 10px;' + FUENTE + 'font-size:11px;letter-spacing:1.6px;text-transform:uppercase;font-weight:700;color:' + C.coral + '">' + html(txt) + '</p>';
}

function bloque(contenido) {
  return '<tr><td style="padding:0 32px 26px">' + contenido + '</td></tr>';
}

function plantilla(m) {
  const datos = m.campos.filter((c) => ['linea', 'email', 'tel', 'url'].indexOf(c[2]) >= 0);
  const opciones = m.campos.filter((c) => c[2] === 'opciones');
  const textos = m.campos.filter((c) => c[2] === 'texto');
  const nombre = (datos.find((c) => c[2] === 'linea') || [])[1] || '';
  const tel = (datos.find((c) => c[2] === 'tel') || [])[1] || '';
  const wa = tel ? whatsapp(tel) : '';
  const prensa = /prensa/i.test(m.asunto);
  const etiqueta = prensa ? 'Nueva nota de prensa' : 'Nuevo contacto';
  const resumen = [nombre].concat(opciones.map((c) => c[1])).concat(textos.map((c) => c[1])).filter(Boolean).join(' · ').slice(0, 140);

  let cuerpo = '';
  if (datos.length) {
    cuerpo += bloque(titulo(prensa ? 'Datos de la nota' : 'Datos de contacto')
      + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">'
      + datos.map((c) => '<tr>'
        + '<td valign="top" style="padding:10px 12px 10px 0;border-bottom:1px solid ' + C.linea + ';' + FUENTE + 'font-size:13px;color:' + C.suave + ';width:34%">' + html(c[0]) + '</td>'
        + '<td valign="top" style="padding:10px 0;border-bottom:1px solid ' + C.linea + ';' + FUENTE + 'font-size:15px;color:' + C.texto + '">' + valorHtml(c) + '</td></tr>').join('')
      + '</table>');
  }
  opciones.forEach((c) => {
    const lista = c[1] ? c[1].split(/\s*,\s*/).filter(Boolean) : [];
    cuerpo += bloque(titulo(c[0]) + (lista.length
      ? lista.map((o) => '<span style="display:inline-block;margin:0 6px 8px 0;padding:7px 14px;border-radius:999px;background:' + C.marino + ';color:' + C.verde + ';' + FUENTE + 'font-size:13px;font-weight:600">' + html(o) + '</span>').join('')
      : '<p style="margin:0;' + FUENTE + 'font-size:14px;color:' + C.suave + ';font-style:italic">No marcó ninguna opción.</p>'));
  });
  textos.forEach((c) => {
    cuerpo += bloque(titulo(c[0])
      + '<div style="padding:16px 18px;background:#f7f8fa;border-left:4px solid ' + C.verde + ';border-radius:4px;' + FUENTE + 'font-size:15px;line-height:1.6;color:' + C.texto + '">' + html(c[1]).replace(/\r?\n/g, '<br>') + '</div>');
  });

  const botones = [];
  if (m.email) botones.push('<a href="mailto:' + html(m.email) + '?subject=' + encodeURIComponent('Re: ' + m.asunto) + '" style="display:inline-block;margin:0 8px 8px 0;padding:13px 22px;border-radius:999px;background:' + C.coral + ';color:#ffffff;text-decoration:none;' + FUENTE + 'font-size:14px;font-weight:700">Responder por correo</a>');
  if (wa) botones.push('<a href="' + wa + '" style="display:inline-block;margin:0 8px 8px 0;padding:13px 22px;border-radius:999px;background:' + C.verde + ';color:' + C.marino + ';text-decoration:none;' + FUENTE + 'font-size:14px;font-weight:700">Escribir por WhatsApp</a>');
  if (botones.length) cuerpo += bloque('<div style="padding-top:4px">' + botones.join('') + '</div>');

  return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + html(m.asunto) + '</title></head>'
    + '<body style="margin:0;padding:0;background:' + C.fondo + '">'
    + '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + html(resumen) + '</div>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + C.fondo + '"><tr><td align="center" style="padding:28px 12px">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">'
    + '<tr><td align="center" style="background:' + C.marino + ';padding:30px 24px 26px">'
    + '<img src="' + SITIO + '/assets/email/logo-torama.png" width="88" height="112" alt="Torama Agency" style="display:block;border:0;width:88px;height:112px">'
    + '<p style="margin:18px 0 0;' + FUENTE + 'font-size:11px;letter-spacing:2.4px;text-transform:uppercase;font-weight:700;color:' + C.verde + '">' + etiqueta + '</p>'
    + '</td></tr>'
    + '<tr><td style="padding:28px 32px 22px">'
    + '<h1 style="margin:0 0 6px;' + FUENTE + 'font-size:22px;line-height:1.3;color:' + C.marino + '">' + (nombre ? html(nombre) + (prensa ? ' envió una nota de prensa' : ' te escribió desde la web') : html(m.asunto)) + '</h1>'
    + '<p style="margin:0;' + FUENTE + 'font-size:13px;color:' + C.suave + '">' + html(fecha()) + '</p>'
    + '</td></tr>'
    + cuerpo
    + '<tr><td style="padding:18px 32px;background:#f7f8fa;border-top:1px solid ' + C.linea + ';' + FUENTE + 'font-size:12px;line-height:1.5;color:' + C.suave + '">'
    + 'Recibido desde el formulario de <a href="' + SITIO + '" style="color:' + C.suave + '">' + html(SITIO.replace(/^https?:\/\//, '')) + '</a>.'
    + (m.email ? ' Si respondes a este correo, la respuesta le llega directamente a ' + html(nombre || m.email) + '.' : '')
    + '</td></tr>'
    + '</table></td></tr></table></body></html>';
}

function textoPlano(m) {
  const partes = [m.asunto, fecha(), ''];
  m.campos.forEach((c) => {
    if (c[2] === 'texto') partes.push('', c[0].toUpperCase(), c[1], '');
    else partes.push(c[0] + ': ' + (c[1] || (c[2] === 'opciones' ? 'No marcó ninguna opción' : '')));
  });
  partes.push('', '— Recibido desde el formulario de ' + SITIO);
  return partes.join('\n');
}

async function porGmail(m) {
  const nodemailer = require('nodemailer');
  const t = nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.GMAIL_USER, pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '') }
  });
  const nombre = (m.campos.find((c) => c[2] === 'linea') || [])[1];
  await t.sendMail({
    from: { name: 'Web Torama', address: process.env.GMAIL_USER },
    to: (process.env.CONTACT_TO || process.env.GMAIL_USER).trim(),
    replyTo: m.email ? { name: nombre || '', address: m.email } : undefined,
    subject: nombre ? m.asunto + ' — ' + nombre : m.asunto,
    text: textoPlano(m),
    html: plantilla(m)
  });
  return { ok: true, via: 'gmail' };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return responder(res, 405, { ok: false, error: 'Método no permitido' });
    if (!origenPermitido(req)) return responder(res, 403, { ok: false, error: 'Origen no permitido' });
    const ip = String(req.headers['x-forwarded-for'] || req.socket && req.socket.remoteAddress || '').split(',')[0].trim();
    if (demasiados(ip)) return responder(res, 429, { ok: false, error: 'Demasiados envíos seguidos. Prueba en unos minutos.' });
    const m = limpiar(await leerCuerpo(req));
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return responder(res, 503, { ok: false, sinCorreo: true, error: 'El correo del formulario aún no está configurado.' });
    }
    return responder(res, 200, await porGmail(m));
  } catch (e) {
    if (e instanceof Fallo) return responder(res, e.status, Object.assign({ ok: e.status === 200, error: e.status === 200 ? undefined : e.message }, e.extra));
    console.error('contacto:', e && e.message);
    return responder(res, 502, { ok: false, error: 'No se pudo enviar el correo.' });
  }
};

/* Escena inmersiva de Torama.
   Un paisaje nocturno (cielo, luna, montañas, agua) dibujado en canvas 2D con
   perspectiva propia. El sello se convierte en una puerta real y la cámara la
   atraviesa para recorrer un túnel de torii mientras se hace scroll. Después
   la escena sigue viva de fondo y pasa de la noche al amanecer (Scene.dayTarget). */
(function () {
  'use strict';

  var cv = document.getElementById('scene');
  if (!cv || !window.TORII) return;
  var ctx = cv.getContext('2d');

  var pGate = new Path2D(window.TORII.gate);
  var pRing = new Path2D(window.TORII.ring);
  // Medidas del torii oficial (unidades locales)
  var OPEN = 39;        // semiancho del paso entre pilares
  var LINTEL = -18;     // borde inferior del travesaño
  var GROUND = 79.5;    // base de los pilares
  var ROOF_Y = -43;     // límite inferior de la viga superior

  var S = (window.Scene = {
    target: 0,          // progreso del túnel (0..1) que marca el scroll
    p: 0,               // progreso suavizado
    dayTarget: 0,       // 0 = noche, 1 = amanecer
    day: 0,
    mouse: { x: 0, y: 0 },
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onFrame: null,
    render: null
  });

  // En las páginas interiores la escena arranca ya "dentro", sin túnel
  if (cv.getAttribute('data-mode') === 'inside') { S.p = S.target = 1; }

  // ---- Mundo -------------------------------------------------------------
  var GAP = 1.1;
  var GATES = [];
  for (var i = 0; i < 7; i++) GATES.push(1 + i * GAP);
  var END = GATES[GATES.length - 1] + 0.3;
  var FAR = 4.6;

  var WORDS = [
    { lines: ['Estrategia'], z: 1.8, weight: 300, color: '#eef3f7' },
    { lines: ['Creatividad'], z: 2.9, weight: 300, color: '#eef3f7' },
    { lines: ['Colaboración'], z: 4.0, weight: 300, color: '#eef3f7' },
    { lines: ['Juntos hacemos'], z: 5.1, weight: 300, color: '#78ffc0' },
    { lines: ['MARKETING DE', 'RESULTADOS'], z: 6.2, weight: 800, color: '#ffffff' }
  ];

  var W = 0, H = 0, DPR = 1, R = 100, ex = 0, ey = 0, mobile = false;
  var parts = [], lanterns = [], stars = null, ridges = [];
  var mx = 0, my = 0, drift = 0, last = 0;

  // ---- Utilidades --------------------------------------------------------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mixA(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
  function rgb(c, a) {
    var s = Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]);
    return a === undefined ? 'rgb(' + s + ')' : 'rgba(' + s + ',' + a.toFixed(3) + ')';
  }
  function mix(c1, c2, t) { return rgb(mixA(c1, c2, t)); }
  function rng(seed) {
    return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  var WHITE = [255, 255, 255];
  var RED_A = [255, 112, 122], RED_B = [230, 65, 76], RED_C = [158, 34, 48];
  var ROOF_A = [96, 128, 184], ROOF_B = [30, 52, 104];
  // Paletas de cielo: noche -> amanecer
  var N_TOP = [6, 13, 26], N_MID = [18, 40, 63], N_HOR = [34, 86, 132];
  var D_TOP = [16, 34, 78], D_MID = [58, 86, 142], D_HOR = [255, 150, 122];
  var W_DEEP = [6, 13, 26];
  var MOON = [200, 255, 228], SUN = [255, 150, 120];

  function fontOf(w, size) {
    return w.weight < 500 ? '400 ' + size + 'px "Caviar Dreams", Poppins, sans-serif' : w.weight + ' ' + size + 'px Poppins, sans-serif';
  }

  function measureWords() {
    WORDS.forEach(function (w) {
      ctx.font = fontOf(w, 100);
      var m = 0;
      w.lines.forEach(function (l) { m = Math.max(m, ctx.measureText(l).width); });
      w.base = Math.min(R * 0.36, ((mobile ? 0.42 : 0.56) * W) / (m / 100));
    });
  }

  // ---- Capas pre-dibujadas (estrellas y montañas) ------------------------
  function buildStars() {
    var c = document.createElement('canvas');
    c.width = Math.round(W * 1.2); c.height = Math.round(H);
    var x = c.getContext('2d'), r = rng(7);
    var n = mobile ? 150 : 320;
    for (var i = 0; i < n; i++) {
      var sx = r() * c.width, sy = Math.pow(r(), 1.5) * c.height, rad = 0.3 + r() * r() * 1.5;
      x.globalAlpha = 0.25 + r() * 0.75;
      x.fillStyle = r() < 0.2 ? '#b4ffdc' : '#ffffff';
      x.beginPath(); x.arc(sx, sy, rad, 0, 6.2832); x.fill();
    }
    return c;
  }

  function buildRidge(seed, amp, base, top, bottom, fuji) {
    var q = Math.min(DPR, 1.5);
    var w = Math.round(W * 2.4 * q), h = Math.round(H * 0.22 * q);
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d'), r = rng(seed);
    var ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
    x.beginPath(); x.moveTo(0, h);
    for (var i = 0; i <= w; i += 3) {
      var u = i / w;
      var n = Math.sin(u * 11 + ph[0]) * 0.5 + Math.sin(u * 27 + ph[1]) * 0.26 + Math.sin(u * 63 + ph[2]) * 0.14 + Math.sin(u * 151 + ph[3]) * 0.07;
      var y = base + amp * (n * 0.5 + 0.5);
      if (fuji) { var f = Math.max(0, 1 - Math.abs(u - fuji) / 0.075); y += f * f * (3 - 2 * f) * 0.5; }
      y *= 1 - 0.86 * Math.exp(-Math.pow((u - 0.5) / 0.05, 2));   // valle por donde pasa el camino
      x.lineTo(i, h - y * h);
    }
    x.lineTo(w, h); x.closePath();
    var g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    x.fillStyle = g; x.fill();
    return { cv: c, w: W * 2.4, h: H * 0.22 };
  }

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    mobile = W < 860;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    if (mobile) { ex = W / 2; ey = H * 0.25; R = Math.min(W * 0.26, H * 0.14); }
    else { ex = W * 0.29; ey = H * 0.45; R = Math.min(W * 0.15, H * 0.25); }
    var rs = document.documentElement.style;
    rs.setProperty('--ex', ex + 'px'); rs.setProperty('--ey', ey + 'px'); rs.setProperty('--er', R + 'px');
    measureWords();

    stars = buildStars();
    ridges = [
      buildRidge(11, 0.42, 0.3, 'rgb(40,78,128)', 'rgb(30,64,110)', 0.62),
      buildRidge(23, 0.5, 0.12, 'rgb(24,50,90)', 'rgb(20,44,80)', 0),
      buildRidge(37, 0.3, 0.04, 'rgb(12,28,52)', 'rgb(10,24,44)', 0)
    ];

    var r = rng(99);
    parts.length = 0;
    var n = mobile ? 60 : 130;
    for (var i = 0; i < n; i++) {
      var petal = r() < 0.62;
      parts.push({
        petal: petal, x: (r() - 0.5) * 780, y: r() * 330 - 250, z: r() * 6,
        s: petal ? 1.2 + r() * 1.8 : 0.6 + r() * 1.2, ph: r() * 6.28, v: 0.02 + r() * 0.05,
        f: 0.4 + r() * 0.9, rot: (r() - 0.5) * 3,
        c: petal ? (r() < 0.6 ? '255,160,170' : '236,84,98') : '120,255,192'
      });
    }
    lanterns.length = 0;
    var ln = mobile ? 8 : 14;
    for (var j = 0; j < ln; j++) {
      lanterns.push({ x: (j % 2 ? 1 : -1) * (100 + r() * 330), z: r() * 8, ph: r() * 6.28 });
    }
    if (S.reduced) render(0);
  }

  // ---- Dibujo ------------------------------------------------------------
  var vx, vy, axisY, cam, rv;

  function fog(d) { return clamp((FAR - d) / (FAR - 2.2), 0, 1); }

  function fillGate(a, m) {
    ctx.globalAlpha = a;
    var gb = ctx.createLinearGradient(-90, 0, 90, 0);
    gb.addColorStop(0, mix(WHITE, RED_A, m)); gb.addColorStop(0.5, mix(WHITE, RED_B, m)); gb.addColorStop(1, mix(WHITE, RED_C, m));
    ctx.fillStyle = gb; ctx.fill(pGate, 'evenodd');
    if (m > 0.01) {                                     // la viga superior toma el tono oscuro de la marca
      ctx.save();
      ctx.beginPath(); ctx.rect(-130, -80, 260, 80 + ROOF_Y); ctx.clip();
      var gr = ctx.createLinearGradient(0, -60, 0, ROOF_Y);
      gr.addColorStop(0, mix(WHITE, ROOF_A, m)); gr.addColorStop(1, mix(WHITE, ROOF_B, m));
      ctx.fillStyle = gr; ctx.fill(pGate, 'evenodd');
      ctx.restore();
    }
  }

  function drawGate(idx, d, p, time) {
    var k = (R / 100) / d;
    var ratio = Math.min((OPEN * k) / Math.max(vx, W - vx), ((30 - LINTEL) * k) / Math.max(vy, 1));
    if (ratio > 1.9) return;
    var a = fog(d) * (1 - smooth(0.95, 1.9, ratio)) * (idx === 0 ? 1 : rv);
    if (a <= 0.003) return;

    var m = idx === 0 ? smooth(0.05, 0.2, p) : 1;      // blanco de logo -> rojo real
    var deco = idx === 0 ? 1 - smooth(0.035, 0.15, p) : 0;

    ctx.save();
    ctx.translate(vx - (mx * R * 0.1) / d, vy - (my * R * 0.06) / d);
    ctx.scale(k, k);
    ctx.translate(0, -axisY);

    if (deco > 0.003) {
      // Círculo y bandas del sello: se abren y se disuelven al empezar el viaje
      var sc = 1 + (1 - deco) * 0.9;
      ctx.save();
      ctx.translate(0, 5); ctx.scale(sc, sc); ctx.translate(0, -5);
      ctx.globalAlpha = a * deco * 0.6;
      ctx.fillStyle = 'rgb(12,27,44)';                   // disco oscuro para que el sello resalte sobre el paisaje
      ctx.beginPath(); ctx.arc(-0.4, 2.8, 92, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.beginPath(); ctx.arc(-0.4, 2.8, 92, 0, Math.PI * 2); ctx.clip();
      // Aurora ascendente (camino) en el verde de la marca
      ctx.globalAlpha = a * deco;
      var bg = ctx.createLinearGradient(-90, 40, 95, -40);
      bg.addColorStop(0, '#0a5a58'); bg.addColorStop(0.55, '#35c79a'); bg.addColorStop(1, '#78ffc0');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.moveTo(-94, 8); ctx.bezierCurveTo(-60, 40, -30, 30, 0, 5); ctx.bezierCurveTo(30, -20, 60, -40, 96, -48);
      ctx.lineTo(96, -6); ctx.bezierCurveTo(60, 0, 35, 16, 5, 40); ctx.bezierCurveTo(-25, 62, -60, 64, -90, 44); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = a * deco * 0.8;
      ctx.fillStyle = '#c4ffe4';
      ctx.beginPath(); ctx.moveTo(14, -44); ctx.bezierCurveTo(44, -62, 70, -70, 96, -74); ctx.lineTo(96, -52); ctx.bezierCurveTo(70, -48, 50, -40, 30, -27); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = a * deco;
      ctx.fillStyle = '#fff'; ctx.fill(pRing, 'evenodd');
      ctx.restore();
    }

    if (m > 0.01) {
      // Reflejo de la puerta en el agua
      ctx.save();
      ctx.beginPath(); ctx.rect(-220, GROUND, 440, 260); ctx.clip();
      ctx.translate(Math.sin(time * 1.3 + idx) * 1.2, GROUND * 2); ctx.scale(1, -1);
      fillGate(a * m * 0.2, m);
      ctx.restore();

      // Luz en la base de cada pilar
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * m * 0.5;
      for (var s = -1; s <= 1; s += 2) {
        var lx = s * 47;
        var g = ctx.createRadialGradient(lx, GROUND, 0, lx, GROUND, 46);
        g.addColorStop(0, 'rgba(120,255,192,.85)'); g.addColorStop(1, 'rgba(120,255,192,0)');
        ctx.fillStyle = g; ctx.fillRect(lx - 46, GROUND - 46, 92, 92);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    fillGate(a, m);
    ctx.restore();
  }

  function drawWord(w, d) {
    var size = w.base / d;
    if (size > H * 1.1) return;
    var a = rv * (1 - smooth(0.82, 1.08, d)) * smooth(0.3, 0.5, d);   // una palabra a la vez
    if (a <= 0.003) return;
    var k = (R / 100) / d;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = w.color;
    ctx.shadowColor = 'rgba(6,13,26,.95)'; ctx.shadowBlur = 28;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = fontOf(w, size.toFixed(1));
    var x = vx - (mx * R * 0.1) / d, y = vy - (my * R * 0.06) / d - 6 * k;
    var n = w.lines.length;
    for (var i = 0; i < n; i++) ctx.fillText(w.lines[i], x, y + (i - (n - 1) / 2) * size * 1.02);
    ctx.restore();
  }

  function orb(x, y, r, core, halo, a, craters) {
    if (a <= 0.004) return;
    var hr = r * 4.2;
    var g = ctx.createRadialGradient(x, y, r * 0.6, x, y, hr);
    g.addColorStop(0, rgb(halo, 0.42 * a)); g.addColorStop(0.35, rgb(halo, 0.12 * a)); g.addColorStop(1, rgb(halo, 0));
    ctx.fillStyle = g; ctx.fillRect(x - hr, y - hr, hr * 2, hr * 2);
    var d = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    d.addColorStop(0, rgb(mixA(core, WHITE, 0.75), a)); d.addColorStop(1, rgb(core, a));
    ctx.fillStyle = d; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    if (craters) {
      ctx.fillStyle = rgb([110, 200, 170], 0.22 * a);
      ctx.beginPath(); ctx.arc(x + r * 0.3, y - r * 0.2, r * 0.2, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(x - r * 0.25, y + r * 0.3, r * 0.14, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(x - r * 0.42, y - r * 0.3, r * 0.09, 0, 6.2832); ctx.fill();
    }
  }

  function streak(x, w, c, a, time) {
    if (a <= 0.004) return;
    for (var i = 0; i < 16; i++) {
      var yy = vy + 3 + Math.pow(i, 1.7) * H * 0.0052;
      if (yy > H) break;
      var ww = w * (0.7 + 0.5 * Math.sin(time * 1.4 + i * 2.1)) * (1 + i * 0.13);
      ctx.fillStyle = rgb(c, a * (1 - i / 16) * 0.42);
      ctx.fillRect(x - ww / 2, yy, ww, 1 + i * 0.3);
    }
  }

  function render(time) {
    var p = S.p, day = S.day;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    var t = smooth(0.03, 0.22, p);
    vx = lerp(ex, W / 2, t) + mx * 14;
    vy = lerp(ey, H * 0.5, t) + my * 8 + H * 0.06 * day;
    axisY = lerp(5, 30, smooth(0.03, 0.25, p));
    cam = END * smooth(0, 1, clamp((p - 0.03) / 0.72, 0, 1));
    rv = smooth(0.05, 0.2, p);
    var inside = smooth(0.72, 0.95, p);

    // Cielo
    var top = mixA(N_TOP, D_TOP, day), mid = mixA(N_MID, D_MID, day), hor = mixA(N_HOR, D_HOR, day);
    var sky = ctx.createLinearGradient(0, 0, 0, vy);
    sky.addColorStop(0, rgb(top)); sky.addColorStop(0.58, rgb(mid)); sky.addColorStop(1, rgb(hor));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, vy + 1);

    if (stars && day < 0.98) {
      ctx.globalAlpha = (1 - day) * (0.75 + 0.25 * Math.sin(time * 0.7));
      ctx.drawImage(stars, -W * 0.1 - mx * 6 + (vx - W / 2) * 0.04, -my * 4 - Math.max(0, H - vy * 2) * 0.1);
      ctx.globalAlpha = 1;
    }

    // Luna (noche) y sol (amanecer)
    var tm = smooth(0.03, 0.25, p);
    var moonX = vx + lerp(mobile ? W * 0.3 : W * 0.43, 0, tm) - mx * 8;
    var moonY = vy - lerp(H * (mobile ? 0.17 : 0.25), R * 0.62, tm) - inside * H * 0.2 + day * (H * 0.2 + R * 2.6);
    var moonR = lerp(Math.min(W, H) * 0.07, R * 0.5, tm) * (1 + 0.8 * smooth(0.25, 0.72, p)) * (1 - 0.66 * inside);
    orb(moonX, moonY, moonR, MOON, [120, 255, 192], (1 - smooth(0.25, 0.8, day)) * (1 - 0.45 * inside), true);
    var sunR = R * 0.95;
    var sunY = vy + sunR * 1.2 - day * sunR * 1.75;
    orb(vx, sunY, sunR, SUN, [240, 110, 96], smooth(0.05, 0.4, day), false);

    // Montañas
    for (var q = 0; q < ridges.length; q++) {
      var rd = ridges[q], sc = 1 + p * 0.1 * (q + 1);
      ctx.drawImage(rd.cv, vx - (rd.w * sc) / 2 - mx * (5 + q * 7), vy - rd.h * sc + 1, rd.w * sc, rd.h * sc);
    }
    // Bruma en el horizonte
    var hz = ctx.createLinearGradient(0, vy - H * 0.16, 0, vy);
    hz.addColorStop(0, rgb(hor, 0)); hz.addColorStop(1, rgb(hor, 0.55 + 0.25 * day));
    ctx.fillStyle = hz; ctx.fillRect(0, vy - H * 0.16, W, H * 0.16 + 1);

    // Agua
    var wg = ctx.createLinearGradient(0, vy, 0, H);
    wg.addColorStop(0, rgb(mixA(hor, W_DEEP, 0.3))); wg.addColorStop(0.3, rgb(mixA(mid, W_DEEP, 0.55))); wg.addColorStop(1, rgb(W_DEEP));
    ctx.fillStyle = wg; ctx.fillRect(0, vy, W, H - vy);
    streak(moonX, moonR * 1.5, MOON, (1 - smooth(0.2, 0.6, day)) * (moonY < vy ? 1 : 0) * (0.3 + 0.7 * tm), time);
    streak(vx, sunR * 1.5, SUN, smooth(0.3, 1, day), time);

    // Bancos de niebla que se desplazan
    for (var f = 0; f < 3; f++) {
      var fx = (((f * 0.37 + time * (0.006 + f * 0.003)) % 1.4) - 0.2) * W;
      var fy = vy - 4 + f * 9, frx = W * (0.3 + f * 0.06);
      ctx.save(); ctx.translate(fx, fy); ctx.scale(1, 0.09);
      var fg = ctx.createRadialGradient(0, 0, 0, 0, 0, frx);
      fg.addColorStop(0, rgb(mixA(hor, WHITE, 0.5), 0.2)); fg.addColorStop(1, rgb(hor, 0));
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(0, 0, frx, 0, 6.2832); ctx.fill();
      ctx.restore();
    }

    // Destellos de trama sobre el agua, en perspectiva
    var camF = cam + drift, gy = GROUND - axisY;
    var fa = rv * (1 - 0.5 * inside);
    if (fa > 0.01) {
      var step = 0.2, z0 = Math.ceil((camF + 0.1) / step) * step;
      ctx.fillStyle = '#78ffc0';
      for (var r = 0; r < 24; r++) {
        var d = z0 + r * step - camF;
        var k = (R / 100) / d;
        var y = vy + gy * k;
        if (y > H + 8) continue;
        var sz = Math.max(1, 2.1 * k);
        ctx.globalAlpha = fog(d) * fa * 0.4;
        var ox = vx - (mx * R * 0.1) / d;
        for (var j = -18; j <= 18; j++) {
          var x = ox + j * 34 * k;
          if (x < -8 || x > W + 8) continue;
          ctx.fillRect(x - sz / 2, y - sz / 4, sz, sz / 2);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Farolillos flotando en el agua
    var camL = camF + time * 0.025;
    for (var l = 0; l < lanterns.length; l++) {
      var ln = lanterns[l];
      var dl = ((((ln.z - camL) % 8) + 8) % 8) + 0.3;
      var kl = (R / 100) / dl;
      var la = clamp((7.6 - dl) / 3, 0, 1) * clamp((dl - 0.3) / 0.35, 0, 1);
      var lx = vx + ln.x * kl - (mx * R * 0.1) / dl;
      var ly = vy + gy * kl + Math.sin(time * 1.1 + ln.ph) * 1.5 * kl;
      if (la <= 0.01 || lx < -60 || lx > W + 60 || ly > H + 40) continue;
      var gr = Math.max(26 * kl, 4);
      var lg = ctx.createRadialGradient(lx, ly - 6 * kl, 0, lx, ly - 6 * kl, gr);
      lg.addColorStop(0, 'rgba(255,170,130,' + (0.55 * la).toFixed(3) + ')'); lg.addColorStop(1, 'rgba(255,120,110,0)');
      ctx.fillStyle = lg; ctx.fillRect(lx - gr, ly - 6 * kl - gr, gr * 2, gr * 2);
      ctx.fillStyle = 'rgba(255,205,160,' + la.toFixed(3) + ')';
      ctx.fillRect(lx - 4 * kl, ly - 11 * kl, 8 * kl, 11 * kl);
      ctx.fillStyle = 'rgba(230,65,76,' + la.toFixed(3) + ')';
      ctx.fillRect(lx - 5 * kl, ly - 12.5 * kl, 10 * kl, 2 * kl);
      ctx.fillRect(lx - 5 * kl, ly - 0.8 * kl, 10 * kl, 1.6 * kl);
      ctx.fillStyle = 'rgba(255,170,130,' + (0.22 * la).toFixed(3) + ')';
      ctx.fillRect(lx - 3 * kl, ly + 2 * kl, 6 * kl, 20 * kl);
    }

    // Puertas y palabras, de lejos a cerca
    var items = [];
    for (var i = 0; i < GATES.length; i++) { var dg = GATES[i] - cam; if (dg > 0.02 && dg < FAR) items.push({ d: dg, g: i }); }
    for (var w = 0; w < WORDS.length; w++) { var dw = WORDS[w].z - cam; if (dw > 0.12 && dw < FAR) items.push({ d: dw, w: WORDS[w] }); }
    items.sort(function (a, b) { return b.d - a.d; });
    for (var n = 0; n < items.length; n++) {
      if (items[n].w) drawWord(items[n].w, items[n].d); else drawGate(items[n].g, items[n].d, p, time);
    }

    // Pétalos y luciérnagas
    for (var s = 0; s < parts.length; s++) {
      var pt = parts[s];
      var dz = (((pt.z - cam - time * pt.v) % 6) + 6) % 6 + 0.1;
      var kk = (R / 100) / dz;
      var yy = pt.petal ? ((((pt.y + 250 + time * pt.f * 16) % 330) + 330) % 330) - 250 : pt.y + Math.sin(time * 0.6 + pt.ph) * 8;
      var px = vx + (pt.x + Math.sin(time * 0.5 + pt.ph) * 14) * kk - (mx * R * 0.1) / dz;
      var py = vy + yy * kk;
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
      var rad = Math.min(pt.s * kk * 1.3, 11);
      var al = clamp(dz / 0.5, 0, 1) * clamp((6 - dz) / 2.5, 0, 1);
      if (pt.petal) {
        ctx.fillStyle = 'rgba(' + pt.c + ',' + (al * 0.85).toFixed(3) + ')';
        ctx.beginPath(); ctx.ellipse(px, py, rad * 1.5, rad * 0.75, time * pt.rot + pt.ph, 0, 6.2832); ctx.fill();
      } else {
        al *= 0.45 + 0.55 * Math.sin(time * 1.6 + pt.ph);
        if (al <= 0.02) continue;
        ctx.fillStyle = 'rgba(' + pt.c + ',' + (al * 0.25).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(px, py, rad * 3, 0, 6.2832); ctx.fill();
        ctx.fillStyle = 'rgba(225,255,240,' + al.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(px, py, rad, 0, 6.2832); ctx.fill();
      }
    }
  }
  S.render = function () { S.p = S.target; S.day = S.dayTarget; render(0); };

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    var time = now / 1000, dt = Math.min(time - last, 0.05); last = time;
    S.p += (S.target - S.p) * 0.1;
    if (Math.abs(S.target - S.p) < 0.0002) S.p = S.target;
    S.day += (S.dayTarget - S.day) * 0.06;
    mx += (S.mouse.x - mx) * 0.06; my += (S.mouse.y - my) * 0.06;
    drift += dt * 0.22 * smooth(0.74, 0.9, S.p);
    render(time);
    if (S.onFrame) S.onFrame(S.p, time);
  }

  window.addEventListener('resize', resize);
  resize();
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('400 20px "Caviar Dreams"'), document.fonts.load('800 20px Poppins')])
      .then(function () { measureWords(); if (S.reduced) render(0); }, function () {});
  }

  if (S.reduced) { render(0); } else { requestAnimationFrame(frame); }
})();

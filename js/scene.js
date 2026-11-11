/* Escena inmersiva de Torama: el sello se convierte en una puerta real y la
   cámara la atraviesa para recorrer un túnel de torii mientras se hace scroll.
   Todo se dibuja en un canvas 2D con proyección en perspectiva propia, así las
   puertas se mantienen nítidas a cualquier escala. */
(function () {
  'use strict';

  var cv = document.getElementById('scene');
  if (!cv || !window.TORII) return;
  var ctx = cv.getContext('2d');

  var pRoof = new Path2D(window.TORII.roof);
  var pBody = new Path2D(window.TORII.body);
  var pExtra = new Path2D(window.TORII.extra);

  var S = (window.Scene = {
    target: 0,          // progreso deseado (0..1) que marca el scroll
    p: 0,               // progreso suavizado
    mouse: { x: 0, y: 0 },
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onFrame: null
  });

  // ---- Mundo -------------------------------------------------------------
  var GAP = 1.1;
  var GATES = [];
  for (var i = 0; i < 7; i++) GATES.push(1 + i * GAP);
  var END = GATES[GATES.length - 1] + 0.3;   // la cámara termina tras la última puerta
  var FAR = 4.6;

  var WORDS = [
    { lines: ['Estrategia'], z: 1.8, weight: 300, color: '#d6dce2' },
    { lines: ['Creatividad'], z: 2.9, weight: 300, color: '#d6dce2' },
    { lines: ['Colaboración'], z: 4.0, weight: 300, color: '#d6dce2' },
    { lines: ['Juntos hacemos'], z: 5.1, weight: 300, color: '#2fe0e8' },
    { lines: ['MARKETING DE', 'RESULTADOS'], z: 6.2, weight: 800, color: '#ffffff' }
  ];

  var W = 0, H = 0, DPR = 1, R = 100, ex = 0, ey = 0, mobile = false;
  var parts = [];
  var mx = 0, my = 0, drift = 0, last = 0;

  // ---- Utilidades --------------------------------------------------------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function mix(c1, c2, t) {
    return 'rgb(' + Math.round(lerp(c1[0], c2[0], t)) + ',' + Math.round(lerp(c1[1], c2[1], t)) + ',' + Math.round(lerp(c1[2], c2[2], t)) + ')';
  }
  var WHITE = [255, 255, 255];
  var RED_A = [255, 112, 122], RED_B = [230, 65, 76], RED_C = [158, 34, 48];
  var ROOF_A = [96, 128, 184], ROOF_B = [38, 60, 104];

  function measureWords() {
    WORDS.forEach(function (w) {
      ctx.font = w.weight + ' 100px Poppins, sans-serif';
      var m = 0;
      w.lines.forEach(function (l) { m = Math.max(m, ctx.measureText(l).width); });
      w.base = Math.min(R * 0.36, ((mobile ? 0.42 : 0.56) * W) / (m / 100));
    });
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
    var n = mobile ? 70 : 150;
    parts.length = 0;
    for (var i = 0; i < n; i++) {
      var r = Math.random();
      parts.push({
        x: (Math.random() - 0.5) * 760, y: Math.random() * 340 - 240, z: Math.random() * 6,
        s: 0.6 + Math.random() * 1.6, ph: Math.random() * 6.28, v: 0.02 + Math.random() * 0.05,
        c: r < 0.55 ? '47,224,232' : r < 0.8 ? '230,65,76' : '214,220,226'
      });
    }
    if (S.reduced) render(0);
  }

  // ---- Dibujo ------------------------------------------------------------
  var vx, vy, axisY, cam, rv;

  function fog(d) { return clamp((FAR - d) / (FAR - 2.2), 0, 1); }

  function drawGate(idx, d, p) {
    var k = (R / 100) / d;
    var ratio = Math.min((48 * k) / Math.max(vx, W - vx), (31 * k) / Math.max(vy, 1));
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
      ctx.globalAlpha = a * deco;
      ctx.save();
      ctx.beginPath(); ctx.arc(0, 5, 94, 0, Math.PI * 2); ctx.clip();
      var bg = ctx.createLinearGradient(-70, 80, 100, -62);
      bg.addColorStop(0, '#1a3d87'); bg.addColorStop(0.55, '#2456b8'); bg.addColorStop(1, '#49d3de');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.moveTo(-70, 80); ctx.lineTo(100, -62); ctx.lineTo(100, -8); ctx.lineTo(-20, 92); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = a * deco * 0.85;
      ctx.fillStyle = '#49d3de';
      ctx.beginPath(); ctx.moveTo(20, -40); ctx.lineTo(100, -100); ctx.lineTo(100, -66); ctx.lineTo(52, -30); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.globalAlpha = a * deco;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 5, 96, Math.PI / 3, Math.PI * 2 + Math.PI / 6); ctx.stroke();
      ctx.restore();
    }

    if (m > 0.01) {
      // Faroles de luz en la base de cada pilar
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a * m * 0.55;
      [-55, 55].forEach(function (x) {
        var g = ctx.createRadialGradient(x, 74, 0, x, 74, 46);
        g.addColorStop(0, 'rgba(47,224,232,.9)'); g.addColorStop(1, 'rgba(47,224,232,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 46, 28, 92, 92);
      });
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.globalAlpha = a;
    var gb = ctx.createLinearGradient(-70, 0, 70, 0);
    gb.addColorStop(0, mix(WHITE, RED_A, m)); gb.addColorStop(0.5, mix(WHITE, RED_B, m)); gb.addColorStop(1, mix(WHITE, RED_C, m));
    ctx.fillStyle = gb; ctx.fill(pBody);
    var gr = ctx.createLinearGradient(0, -72, 0, -38);
    gr.addColorStop(0, mix(WHITE, ROOF_A, m)); gr.addColorStop(1, mix(WHITE, ROOF_B, m));
    ctx.fillStyle = gr; ctx.fill(pRoof);
    if (m > 0.01) {                                     // filo rojo bajo el tejado
      ctx.globalAlpha = a * m;
      ctx.strokeStyle = 'rgb(230,65,76)'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(97, -49); ctx.quadraticCurveTo(50, -39, 0, -39); ctx.quadraticCurveTo(-50, -39, -97, -49); ctx.stroke();
    }
    if (idx === 0 && m < 0.99) { ctx.globalAlpha = a * (1 - m); ctx.fillStyle = '#fff'; ctx.fill(pExtra); }
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
    ctx.shadowColor = 'rgba(11,26,43,.95)'; ctx.shadowBlur = 26;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = w.weight + ' ' + size.toFixed(1) + 'px Poppins, sans-serif';
    var x = vx - (mx * R * 0.1) / d, y = vy - (my * R * 0.06) / d - 6 * k;
    var n = w.lines.length;
    for (var i = 0; i < n; i++) ctx.fillText(w.lines[i], x, y + (i - (n - 1) / 2) * size * 1.02);
    ctx.restore();
  }

  function render(time) {
    var p = S.p;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    var t = smooth(0.03, 0.22, p);
    vx = lerp(ex, W / 2, t) + mx * 14;
    vy = lerp(ey, H * 0.5, t) + my * 8;
    axisY = lerp(5, 30, smooth(0.03, 0.25, p));
    cam = END * smooth(0, 1, clamp((p - 0.03) / 0.72, 0, 1));
    rv = smooth(0.05, 0.2, p);
    var inside = smooth(0.72, 0.95, p);

    // Luz al final del camino
    var ga = (0.1 + 0.34 * smooth(0.08, 0.8, p)) * (1 - 0.55 * inside);
    var gr = R * (1.3 + 4.2 * p);
    var g = ctx.createRadialGradient(vx, vy, 0, vx, vy, gr);
    g.addColorStop(0, 'rgba(120,236,242,' + ga.toFixed(3) + ')');
    g.addColorStop(0.35, 'rgba(47,224,232,' + (ga * 0.45).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(26,61,135,0)');
    ctx.fillStyle = g; ctx.fillRect(vx - gr, vy - gr, gr * 2, gr * 2);

    // Suelo de puntos (trama de la marca) en perspectiva
    var fa = rv * (1 - 0.6 * inside);
    if (fa > 0.01) {
      var camF = cam + drift, step = 0.2, gy = 76 - axisY;
      var z0 = Math.ceil((camF + 0.1) / step) * step;
      ctx.fillStyle = '#2fe0e8';
      for (var r = 0; r < 24; r++) {
        var d = z0 + r * step - camF;
        var k = (R / 100) / d;
        var y = vy + gy * k;
        if (y > H + 8) continue;
        var sz = Math.max(1, 2.1 * k);
        ctx.globalAlpha = fog(d) * fa * 0.5;
        var ox = vx - (mx * R * 0.1) / d;
        for (var j = -18; j <= 18; j++) {
          var x = ox + j * 34 * k;
          if (x < -8 || x > W + 8) continue;
          ctx.fillRect(x - sz / 2, y - sz / 4, sz, sz / 2);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Puertas y palabras, de lejos a cerca
    var items = [];
    for (var i = 0; i < GATES.length; i++) { var dg = GATES[i] - cam; if (dg > 0.02 && dg < FAR) items.push({ d: dg, g: i }); }
    for (var q = 0; q < WORDS.length; q++) { var dw = WORDS[q].z - cam; if (dw > 0.12 && dw < FAR) items.push({ d: dw, w: WORDS[q] }); }
    items.sort(function (a, b) { return b.d - a.d; });
    for (var n = 0; n < items.length; n++) {
      if (items[n].w) drawWord(items[n].w, items[n].d); else drawGate(items[n].g, items[n].d, p);
    }

    // Partículas flotando en el aire
    var pa = 0.35 + 0.65 * rv;
    for (var s = 0; s < parts.length; s++) {
      var pt = parts[s];
      var dz = (((pt.z - cam - time * pt.v) % 6) + 6) % 6 + 0.1;
      var kk = (R / 100) / dz;
      var px = vx + pt.x * kk - (mx * R * 0.1) / dz;
      var py = vy + (pt.y + Math.sin(time * 0.6 + pt.ph) * 8) * kk;
      if (px < -20 || px > W + 20 || py < -20 || py > H + 20) continue;
      var rad = Math.min(pt.s * kk * 1.3, 9);
      var al = clamp(dz / 0.5, 0, 1) * clamp((6 - dz) / 2.5, 0, 1) * pa * (0.5 + 0.5 * Math.sin(time * 1.3 + pt.ph));
      ctx.fillStyle = 'rgba(' + pt.c + ',' + (al * 0.9).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, rad, 0, 6.2832); ctx.fill();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) return;
    var time = now / 1000, dt = Math.min(time - last, 0.05); last = time;
    S.p += (S.target - S.p) * 0.1;
    if (Math.abs(S.target - S.p) < 0.0002) S.p = S.target;
    mx += (S.mouse.x - mx) * 0.06; my += (S.mouse.y - my) * 0.06;
    drift += dt * 0.22 * smooth(0.74, 0.9, S.p);
    render(time);
    if (S.onFrame) S.onFrame(S.p);
  }

  window.addEventListener('resize', resize);
  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measureWords(); if (S.reduced) render(0); });

  if (S.reduced) { render(0); } else { requestAnimationFrame(frame); }
})();

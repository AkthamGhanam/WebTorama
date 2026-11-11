/* Geometría única del torii de Torama.
   Unidades locales: la puerta mide ~200 de ancho; el origen (0,0) es el centro
   del sello. Se usa tanto en el canvas (Path2D) como en los SVG del sitio. */
(function () {
  'use strict';

  // Viga superior curva (kasagi)
  var ROOF =
    'M-104 -70 Q-52 -55 0 -55 Q52 -55 104 -70 L97 -49 Q50 -39 0 -39 Q-50 -39 -97 -49 Z';

  // Cuerpo: viga secundaria, travesaño, pilares y bases
  var BODY = [
    'M-84 -46 Q0 -34 84 -46 L81 -35 Q0 -25 -81 -35 Z',   // shimaki
    'M-80 -13 H80 V-3 H-80 Z',                            // nuki
    'M-61 -34 H-49 L-48 76 H-62 Z',                       // pilar izquierdo
    'M49 -34 H61 L62 76 H48 Z',                           // pilar derecho
    'M-66 62 H-44 V76 H-66 Z',                            // base izquierda
    'M44 62 H66 V76 H44 Z'                                // base derecha
  ].join(' ');

  // Detalles propios del logo: postes laterales y travesaños cortos
  var EXTRA = [
    'M-92 14 H-42 V21 H-92 Z', 'M42 14 H92 V21 H42 Z',
    'M-88 29 H-64 V34 H-88 Z', 'M64 29 H88 V34 H64 Z',
    'M-84 21 H-76 V64 H-84 Z', 'M76 21 H84 V64 H76 Z'
  ].join(' ');

  window.TORII = { roof: ROOF, body: BODY, extra: EXTRA };

  // Inyecta la forma en los SVG compartidos del documento
  document.querySelectorAll('[data-torii]').forEach(function (g) {
    var d = ROOF + ' ' + BODY + (g.getAttribute('data-torii') === 'logo' ? ' ' + EXTRA : '');
    g.innerHTML = '<path d="' + d + '"/>';
  });
})();

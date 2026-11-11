# WebTorama

Página de inicio inmersiva de **Torama Agency**, construida a partir del diseño "Sitio Web Torama" de Canva.

Al hacer scroll, el sello (el torii dentro del círculo) se convierte en una puerta real y la cámara la cruza para recorrer un túnel de torii sobre el agua, de noche, hasta llegar "Dentro de Torama". Al seguir bajando la escena pasa de la noche al amanecer y cada sección cambia de ambiente, hasta el pie con el sol saliendo tras la puerta.

## Ver en local

Es un sitio estático, sin dependencias ni build:

```bash
python3 -m http.server 8000
```

y abrir `http://localhost:8000`.

## Estructura

- `index.html` — contenido de la página de inicio.
- `css/styles.css` — estilos (paleta y tipografías del diseño de Canva).
- `js/torii.js` — geometría única del torii (se usa en el canvas y en los SVG).
- `js/scene.js` — paisaje y túnel en canvas, guiados por el scroll.
- `js/main.js` — navegación, ambientes por sección, revelados, contadores tipo odómetro, galería horizontal de servicios, marquesina y menú.
- `assets/` — fotos y logos recortados de la exportación de Canva.

## Pendiente

- Sustituir los logos de clientes (`assets/clientes/`) y las fotos por los archivos originales: los actuales son recortes de la exportación del diseño.
- El sello está redibujado en vectores; conviene reemplazarlo por el logo oficial en SVG.
- Páginas internas: Quiénes somos, Servicios, Casos de éxito y Contacto (el texto ya está extraído del diseño).

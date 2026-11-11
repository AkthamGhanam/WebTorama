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

## Marca

Colores, tipografía e imagotipo salen del manual corporativo:

- Verde `#78ffc0`, teal oscuro `#00242b`, blanco y negro, más el coral `#e6414c` como contraste. El morado `#6750d6` del manual no se usa.
- Tipografía Caviar Dreams (`assets/fonts/`) para el logotipo y los textos finos; Poppins para títulos y cuerpo.
- El torii, el círculo y el logotipo "Torama Agency" son los trazados vectoriales del manual (`js/torii.js`). La aurora del sello está redibujada en verde.

## Pendiente

- Sustituir los logos de clientes (`assets/clientes/`) y las fotos por los archivos originales: los actuales son recortes de la exportación de Canva.
- Páginas internas: Quiénes somos, Servicios, Casos de éxito y Contacto.

# WebTorama

Página de inicio inmersiva de **Torama Agency**, construida a partir del diseño "Sitio Web Torama" de Canva.

Al hacer scroll, el sello (el torii dentro del círculo) se convierte en una puerta real y la cámara la cruza para recorrer un túnel de torii sobre el agua, de noche, hasta llegar "Dentro de Torama". Al seguir bajando la escena pasa de la noche al amanecer y cada sección cambia de ambiente, hasta el pie con el sol saliendo tras la puerta.

## Ver en local

Es un sitio estático, sin dependencias ni build:

```bash
python3 -m http.server 8000
```

y abrir `http://localhost:8000`.

## Páginas

- `index.html` — portada inmersiva, con el formulario de contacto.
- `casos.html` — todos los trabajos y casos de éxito, con filtros por servicio y página de detalle (`casos.html?c=…`).
- `noticias.html` — el Noticiero: listado, búsqueda, lectura (`noticias.html?n=…`) y formulario público "Envía tu noticia".
- `admin.html` — panel del equipo para publicar noticias y casos.

## Contenido

Las noticias y los casos son datos, no HTML:

- `content/noticias.json` y `content/casos.json` — las entradas (título, texto en Markdown, portada, "Creado por", fecha, publicado o borrador…).
- `content/media/` — las imágenes.

Se editan desde `admin.html`. El panel habla directamente con GitHub: cada guardado es un commit en `main` y, si existe la rama `gh-pages`, la pone al día para que GitHub Pages lo publique. Para entrar hace falta una llave (fine-grained token) con permiso **Contents: Read and write** sobre este repositorio; los pasos están en la propia pantalla de acceso.

Los borradores no se muestran en la web, pero al ser un repositorio público sí son visibles en GitHub.

## Formularios

Los formularios (contacto y "Envía tu noticia") llegan a `Contenido.toramaagency@gmail.com` a través de [FormSubmit](https://formsubmit.co), sin servidor propio. La primera vez que alguien envíe un formulario, FormSubmit manda a ese buzón un correo de activación que hay que confirmar una sola vez. Si el envío falla, el formulario ofrece mandarlo por correo o WhatsApp.

## Estructura

- `css/styles.css` — estilos base y de la portada. `css/pages.css` — páginas interiores. `css/admin.css` — panel.
- `js/torii.js` — imagotipo oficial en vectores (canvas y SVG).
- `js/scene.js` — paisaje y túnel en canvas, guiados por el scroll.
- `js/main.js` — interacciones de la portada.
- `js/content.js` — carga de contenido, Markdown seguro y envío de formularios.
- `js/site.js` — cabecera, menú y pie de las páginas interiores.
- `js/casos.js`, `js/noticias.js`, `js/admin.js` — lógica de cada página.
- `assets/` — fotos, logos y tipografías.

## Marca

Colores, tipografía e imagotipo salen del manual corporativo:

- Verde `#78ffc0`, teal oscuro `#00242b`, blanco y negro, más el coral `#e6414c` como contraste. El morado `#6750d6` del manual no se usa.
- Tipografía Caviar Dreams (`assets/fonts/`) para el logotipo y los textos finos; Poppins para títulos y cuerpo.
- El torii, el círculo y el logotipo "Torama Agency" son los trazados vectoriales del manual (`js/torii.js`). La aurora del sello está redibujada en verde.

## Pendiente

- Sustituir los logos de clientes (`assets/clientes/`) y las fotos por los archivos originales: los actuales son recortes de la exportación de Canva.
- Páginas internas pendientes: Quiénes somos, Servicios y Contacto.

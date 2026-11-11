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
- `privacidad.html` — política de privacidad (incluye las instrucciones de eliminación de datos en `privacidad.html#eliminacion`).

## Contenido

Las noticias y los casos son datos, no HTML:

- `content/noticias.json` y `content/casos.json` — las entradas (título, texto en Markdown, portada, "Creado por", fecha, publicado o borrador…).
- `content/media/` — las imágenes.

Se editan desde `admin.html`. Cada guardado es un commit en `main` (texto e imágenes juntos) y el sitio se vuelve a publicar solo.

Hay dos formas de entrar al panel:

- **Clave del equipo** (recomendada, en Vercel). Todo el equipo usa la misma clave; cada persona pone además su nombre, que es el que sale en "Creado por". La clave la comprueba la función `api/panel.js`, que es quien publica en GitHub con un token guardado en el servidor.
- **Llave de GitHub** (alternativa). Con un token personal, directamente contra GitHub. Sirve donde no hay servidor, por ejemplo en GitHub Pages.

Los borradores no se muestran en la web, pero al ser un repositorio público sí son visibles en GitHub.

## Publicar en Vercel

1. En Vercel: **Add New → Project**, importa el repositorio `WebTorama`. Framework preset: **Other**. Sin comando de build ni carpeta de salida.
2. En GitHub crea un token para el servidor: **Settings → Developer settings → Fine-grained tokens → Generate new token**, con acceso solo a `WebTorama` y permiso **Contents: Read and write**.
3. En Vercel, **Settings → Environment Variables**, añade:

   | Variable | Valor |
   |---|---|
   | `TEAM_KEY` | La clave que usará el equipo para entrar al panel. Larga y difícil de adivinar. |
   | `GITHUB_TOKEN` | El token del paso 2. |
   | `PUBLISH_BRANCH` | Opcional. Déjala vacía si ya no se usa GitHub Pages; por defecto pone al día `gh-pages`. |

4. Vuelve a desplegar (**Deployments → Redeploy**) para que tome las variables.

Para cambiar la clave del equipo basta con cambiar `TEAM_KEY` y volver a desplegar. Cada publicación desde el panel crea un commit y Vercel despliega solo; tarda alrededor de un minuto.

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
- `api/panel.js` — función de servidor (Vercel) que valida la clave del equipo y publica en el repositorio.
- `assets/` — fotos, logos y tipografías.

## Marca

Colores, tipografía e imagotipo salen del manual corporativo:

- Verde `#78ffc0`, teal oscuro `#00242b`, blanco y negro, más el coral `#e6414c` como contraste. El morado `#6750d6` del manual no se usa.
- Tipografía Caviar Dreams (`assets/fonts/`) para el logotipo y los textos finos; Poppins para títulos y cuerpo.
- El torii, el círculo y el logotipo "Torama Agency" son los trazados vectoriales del manual (`js/torii.js`). La aurora del sello está redibujada en verde.

## Pendiente

- Los logos de `assets/clientes/` que no son originales (Psicomooc, Hotel Manantial, Lux Spa, Trigu's, ICOR, Break Empresarial, Diseños JD y dos sin identificar) son recortes de Canva con el fondo eliminado; conviene sustituirlos por los archivos originales. Las fotos también son recortes.
- Páginas internas pendientes: Quiénes somos, Servicios y Contacto.

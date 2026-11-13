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
- `noticias.html` — el Blog: listado, búsqueda, lectura (`noticias.html?n=…`) y formulario público "Envía tu nota de prensa".
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
   | `GMAIL_USER` | Cuenta de Gmail que envía y recibe los formularios (ver "Formularios"). |
   | `GMAIL_APP_PASSWORD` | Contraseña de aplicación de esa cuenta. |
   | `CONTACT_TO` | Opcional. Otro buzón donde recibir los formularios. |

4. Vuelve a desplegar (**Deployments → Redeploy**) para que tome las variables.

Para cambiar la clave del equipo basta con cambiar `TEAM_KEY` y volver a desplegar. Cada publicación desde el panel crea un commit y Vercel despliega solo; tarda alrededor de un minuto.

## Formularios

Los formularios (contacto y "Envía tu nota de prensa") se envían a la función propia `api/contacto.js`, en el mismo dominio de la web, así que funcionan desde cualquier red (formsubmit.co, por ejemplo, no carga desde algunas redes de Venezuela). La función manda el correo por Gmail con la cuenta de `GMAIL_USER`: sin servicios intermedios ni correos de activación, y "Responder" contesta directamente al visitante.

Para activarlo:

1. Entra en la cuenta de Google que va a enviar los formularios (por ejemplo `Contenido.toramaagency@gmail.com`) → **Gestionar tu cuenta de Google → Seguridad**. Activa la **Verificación en dos pasos** si no lo está.
2. Busca **Contraseñas de aplicaciones** (myaccount.google.com/apppasswords), crea una llamada "Web Torama" y copia los 16 caracteres.
3. En Vercel → **Settings → Environment Variables** añade `GMAIL_USER` (el correo) y `GMAIL_APP_PASSWORD` (la contraseña de aplicación). Opcional: `CONTACT_TO` si quieres recibir en otro buzón.
4. **Deployments → Redeploy** para que tome las variables.

Mientras falten esas variables, o donde no hay servidor (GitHub Pages, `python3 -m http.server`), el formulario prueba a enviar directo a [FormSubmit](https://formsubmit.co) con el buzón de `T.EMAIL` (`js/content.js`), que la primera vez exige confirmar un correo «Activate Form». Si el envío falla, ofrece mandarlo por correo o WhatsApp.

## Estructura

- `css/styles.css` — estilos base y de la portada. `css/pages.css` — páginas interiores. `css/admin.css` — panel.
- `js/torii.js` — logo oficial en vectores (canvas y SVG).
- `js/scene.js` — paisaje y túnel en canvas, guiados por el scroll.
- `js/main.js` — interacciones de la portada.
- `js/content.js` — carga de contenido, Markdown seguro y envío de formularios.
- `js/site.js` — cabecera, menú y pie de las páginas interiores.
- `js/casos.js`, `js/noticias.js`, `js/admin.js` — lógica de cada página.
- `api/panel.js` — función de servidor (Vercel) que valida la clave del equipo y publica en el repositorio.
- `api/contacto.js` — función de servidor que recibe los formularios y los envía por Gmail.
- `api/seo.js` — genera `/sitemap.xml` (páginas, noticias y casos publicados) y `/robots.txt` con el dominio en uso.
- `assets/` — fotos, logos y tipografías.

## Marca

Colores, tipografía e imagotipo salen del manual corporativo:

- Azul marino `#12283f` como color principal (el fondo del logo), verde `#78ffc0` como acento, blanco, y el coral `#e6414c` como contraste. El morado `#6750d6` del manual no se usa.
- Montserrat para el nombre de la marca (la tipografía del logo), Caviar Dreams (`assets/fonts/`) para los textos finos y Poppins para títulos y cuerpo.
- El logo es la última versión de la marca: aro abierto, torii y aurora azul. El aro, el torii y el logotipo "Torama Agency" están trazados en vectores a partir del arte original (`js/torii.js`); la aurora es una imagen (`assets/logo-aurora.webp`). El favicon (`assets/favicon.png`) y el logo de los correos (`assets/email/logo-torama.png`) salen del mismo arte.

## Pendiente

- Los logos de `assets/clientes/` que no son originales (Psicomooc, Hotel Manantial, Lux Spa, Trigu's, ICOR, Break Empresarial, Diseños JD y dos sin identificar) son recortes de Canva con el fondo eliminado; conviene sustituirlos por los archivos originales. Las fotos también son recortes.
- Páginas internas pendientes: Quiénes somos, Servicios y Contacto.

# Vortex · Guía de instalación

Vortex funciona igual en computadora, tableta y celular, desde el navegador.
Para dejarlo funcionando necesitas tres cosas: preparar **Supabase** (la base de datos), subir el proyecto a **GitHub** y publicarlo en **Netlify**.

## Qué hay en esta carpeta

| Carpeta o archivo | Para qué sirve |
|---|---|
| `supabase/01_base_de_datos.sql` | Crea todas las tablas, la seguridad y el almacenamiento de imágenes. Se pega una sola vez. |
| `supabase/02_administrador.sql` | Convierte tu usuario en administrador. |
| `src/` | Código de la aplicación. No necesitas tocarlo. |
| `public/` | Logo, encabezado de cotización e ícono de Vortex. |
| `netlify.toml` | Configuración lista para Netlify. |
| `.env.example` | Muestra los nombres de las dos variables de conexión. |

---

## Parte 1 · Supabase (base de datos)

1. Entra a **supabase.com**, inicia sesión y pulsa **New project**. Ponle un nombre (por ejemplo *vortex*), escribe una contraseña para la base de datos y guárdala. En región elige **South America (São Paulo)**. Espera a que termine de crearse.
2. En el menú izquierdo abre **SQL Editor** y pulsa **New query**.
3. Abre el archivo `supabase/01_base_de_datos.sql` con el Bloc de notas, copia **todo** el contenido, pégalo y pulsa **Run**. Debe aparecer **Success**.
4. Ve a **Authentication → Sign In / Providers** y **desactiva** la opción **Allow new users to sign up**. Así nadie puede registrarse por su cuenta. Guarda.
5. Ve a **Authentication → Users → Add user → Create new user**. Escribe tu correo y tu contraseña, deja marcado **Auto Confirm User** y pulsa **Create user**.
6. Vuelve a **SQL Editor → New query**. Copia el archivo `supabase/02_administrador.sql`, cambia `tu-correo@ejemplo.com` por el correo del paso 5 (dentro de las comillas) y pulsa **Run**. Abajo debe aparecer tu correo con el rol **admin**.
7. **Almacenamiento de imágenes:** el script del paso 3 ya creó la carpeta. Para comprobarlo abre **Storage**: debe existir un bucket llamado **`vortex`**, **privado**.
   Si no aparece, créalo tú: **New bucket** → nombre exacto `vortex` → deja **desactivado** "Public bucket" → **Create**. Luego vuelve a ejecutar el script del paso 3.
8. Copia tus dos datos de conexión. Abre **Project Settings** (ícono de engranaje) → **API** o **Data API / API Keys**:
   - **Project URL** (algo como `https://abcdxyz.supabase.co`)
   - La clave pública: **anon public** o **Publishable key** (empieza con `eyJ…` o con `sb_publishable_…`)

   **Nunca** uses la clave llamada *service_role* o *secret*.

## Parte 2 · GitHub (guardar el proyecto)

1. Descomprime el ZIP en tu computadora.
2. Entra a **github.com**, pulsa **New repository**, ponle un nombre (por ejemplo *vortex*), márcalo como **Private** y pulsa **Create repository**.
3. En la página del repositorio pulsa **uploading an existing file**.
4. Abre la carpeta descomprimida, selecciona **todo su contenido** (las carpetas `src`, `public`, `supabase` y los archivos `package.json`, `netlify.toml`, `index.html`, etc.) y arrástralo a la página. No subas la carpeta contenedora, sino lo que está dentro.
5. Pulsa **Commit changes**.

## Parte 3 · Netlify (publicar)

1. Entra a **netlify.com** → **Add new site** → **Import an existing project** → **GitHub** y elige tu repositorio *vortex*.
2. Netlify detecta la configuración sola (Build command `npm run build`, Publish directory `dist`). No cambies nada.
3. **Antes de publicar**, en la misma pantalla busca **Environment variables** (o "Add environment variables") y agrega las dos:

   | Nombre (Key) | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | Tu Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Tu clave pública (anon o publishable) |

4. Pulsa **Deploy**. Espera uno o dos minutos hasta que diga **Published**.
5. Abre la dirección que te da Netlify (algo como `https://vortex-123.netlify.app`) e inicia sesión con el correo y la contraseña del paso 5 de Supabase.

Si agregaste o cambiaste las variables **después** de publicar, ve a **Deploys → Trigger deploy → Deploy site** para que tomen efecto.

---

## Uso diario

- **Crear más usuarios:** entra como administrador → menú **Usuarios** → **Crear usuario**. No necesitas volver a Supabase.
  - *Operador:* usa todos los módulos.
  - *Administrador:* además crea usuarios y cambia la configuración general.
- **Olvido de contraseña:** el administrador asigna una nueva desde **Usuarios → Contraseña**. Cada persona puede cambiar la suya en **Configuración → Mi cuenta**.
- **Empresas emisoras:** la empresa *Vortex* ya viene cargada con su logo y su encabezado. Puedes cambiar los datos, el logo y el encabezado desde **Empresas emisoras**.
- **Usar en el celular:** abre la dirección de Netlify en el navegador del celular. Puedes añadirla a la pantalla de inicio desde el menú del navegador ("Agregar a pantalla de inicio").

## Copias de seguridad

El plan gratuito de Supabase no hace copias automáticas descargables y pausa los proyectos que no se usan durante una semana. Cuando empieces a trabajar con datos reales, se recomienda el plan **Pro** de Supabase, que guarda copias diarias.

## Si algo falla

- **"Falta conectar Supabase":** faltan las variables en Netlify o tienen otro nombre. Revisa la Parte 3, paso 3, y vuelve a publicar.
- **"Correo o contraseña incorrectos":** revisa el usuario en Supabase → Authentication → Users.
- **"Este usuario existe pero no tiene acceso":** no se ejecutó bien `02_administrador.sql`, o el correo no coincide.
- **No se suben imágenes:** revisa que exista el bucket `vortex` (Parte 1, paso 7).

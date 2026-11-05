# Vortex · Guía de instalación

Vortex funciona igual en computadora, tableta y celular, desde el navegador.
Para dejarlo funcionando necesitas tres cosas: preparar **Supabase** (la base de datos), subir el proyecto a **GitHub** y publicarlo en **Netlify**.

## Qué hay en esta carpeta

| Carpeta o archivo | Para qué sirve |
|---|---|
| `supabase/01_base_de_datos.sql` | Crea todas las tablas, la seguridad y el almacenamiento de imágenes. Se pega una sola vez. |
| `supabase/02_administrador.sql` | Convierte tu usuario en administrador. |
| `supabase/03_actualizacion_v1_1.sql` | Solo para bases ya instaladas: aplica las mejoras de la versión 1.1. |
| `supabase/05_actualizacion_v1_5.sql` | Solo para bases ya instaladas: firma en las cotizaciones (versión 1.5). |
| `supabase/04_actualizacion_v1_4.sql` | Solo para bases ya instaladas: proveedor en las cotizaciones y costos aparte (versiones 1.3 y 1.4). |
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

## Actualizar Vortex a una versión nueva

1. Si la versión trae un archivo `supabase/03_actualizacion_…sql`, ejecútalo una vez en **SQL Editor** (no hace falta volver a ejecutar el 01 ni el 02).
2. Reemplaza los archivos de tu carpeta por los de la versión nueva y súbelos con Git:

```powershell
git add .
git commit -m "Vortex 1.5.1"
git push
```

Netlify publica los cambios solo, en uno o dos minutos.

## Recuperar contraseña por correo (versión 1.2)

En la pantalla de inicio de sesión está **¿Olvidaste tu contraseña?**. Para que el enlace del correo funcione, configura Supabase una sola vez:

1. **Authentication → URL Configuration**
   - **Site URL:** tu dirección de Netlify, por ejemplo `https://vortexseguridad.netlify.app`
   - **Redirect URLs → Add URL:** la misma dirección terminada en `/**`, por ejemplo `https://vortexseguridad.netlify.app/**`
   - Pulsa **Save**.
2. **Envío de correos.** Sin configuración adicional, Supabase solo envía correos a los miembros de tu equipo de Supabase (normalmente, el correo con el que creaste tu cuenta de Supabase) y como máximo 2 por hora. Para que también les lleguen a tus empleados:
   - En Gmail activa la **verificación en 2 pasos** y crea una **contraseña de aplicación** (Cuenta de Google → Seguridad → Contraseñas de aplicaciones).
   - En Supabase ve a **Authentication → Emails → SMTP Settings** y activa **Enable custom SMTP**:
     - Sender email: tu correo de Gmail · Sender name: `Vortex`
     - Host: `smtp.gmail.com` · Port: `465`
     - Username: tu correo de Gmail · Password: la contraseña de aplicación de 16 letras
   - Pulsa **Save changes**.
3. *(Opcional, requiere el paso 2)* En **Authentication → Emails → Templates → Reset Password** puedes poner el correo en español:
   - Subject: `Crea tu nueva contraseña de Vortex`
   - Body: `<h2>Vortex</h2><p>Pulsa el enlace para crear una contraseña nueva:</p><p><a href="{{ .ConfirmationURL }}">Crear nueva contraseña</a></p><p>Si no lo pediste, ignora este correo.</p>`

Aunque no configures el correo, el administrador siempre puede asignar una contraseña nueva desde **Usuarios → Contraseña**.

## Novedades de la versión 1.5.1

- Corregido: ya se pueden guardar clientes, proveedores, instaladores y empresas con el NIT vacío.
- La firma se recorta sola (quita los bordes vacíos de la imagen), se agranda hasta ocupar la línea y queda apoyada sobre ella.
- La firma aparece justo debajo del último texto de la cotización.

## Novedades de la versión 1.5

- **Firma al final de la cotización.** En **Empresas emisoras** cada empresa tiene su firma: sube la imagen (PNG sin fondo) y en **Editar datos** escribe el nombre, el cargo y los datos adicionales que van debajo (teléfono, CI, correo…).
- En cada cotización, la casilla **"Incluir la firma al final de la cotización"** permite ponerla o quitarla.
- Las cotizaciones ya enviadas conservan los datos de la empresa de ese momento; la firma aparece en las nuevas y en las que vuelvas a enviar.

## Novedades de la versión 1.4

- **Agregar varios productos a la vez:** en el buscador marcas todos los que necesitas, ajustas la cantidad de cada uno y los agregas juntos.
- **Totales en las tablas:** al pie de equipos y de servicios se ve el costo real total y el total al cliente.
- **Costos aparte:** nueva sección para gastos internos que no se cobran por separado ni salen en el PDF (viáticos, comisiones, alquileres). Se suman al costo total.
- **Resumen "Costos y ganancia"** debajo del total del cliente: costo real de equipos, costo real de servicios y otros, costo de la cotización, costos aparte, costo total, ganancia líquida y margen de ganancia.
- En el proyecto, el presupuesto muestra el mismo desglose, y al agregar un adicional puedes marcar **"Ya lo pagué"** para que se sume también al costo real.

## Novedades de la versión 1.3

- Cada equipo o material de la cotización tiene su **proveedor** (se propone el del catálogo y se puede cambiar o crear uno nuevo ahí mismo).
- El panel interno muestra **Compras por proveedor**: cuánto debes comprar a cada uno.
- El proveedor pasa al presupuesto y a los materiales del proyecto.
- El proveedor es información interna: **nunca aparece en el PDF** del cliente.

## Novedades de la versión 1.2

- **¿Olvidaste tu contraseña?** en la pantalla de inicio de sesión, con enlace por correo para crear una nueva.
- Botón con forma de **ojo** en todos los campos de contraseña para ver lo que se escribe.

## Novedades de la versión 1.1

- Aviso antes de salir de una cotización con cambios sin guardar, y **Ctrl + S** para guardar en la computadora.
- Botón **Compartir** en la vista previa: en el celular envía el PDF directo por WhatsApp, correo u otras apps.
- El PDF se descarga con el número de cotización y el nombre del cliente.
- Vortex se puede **instalar en el celular** con su ícono ("Agregar a pantalla de inicio").
- Los datos se actualizan solos al volver a la aplicación.
- Buscador en Proyectos y aviso si un cobro supera el saldo pendiente.
- Si una pantalla falla o se publicó una versión nueva, aparece un aviso para recargar en lugar de una página en blanco.
- Siempre queda al menos un administrador activo, y los cambios de usuarios quedan en el historial.

## Copias de seguridad

El plan gratuito de Supabase no hace copias automáticas descargables y pausa los proyectos que no se usan durante una semana. Cuando empieces a trabajar con datos reales, se recomienda el plan **Pro** de Supabase, que guarda copias diarias.

## Si algo falla

- **"Falta conectar Supabase":** faltan las variables en Netlify o tienen otro nombre. Revisa la Parte 3, paso 3, y vuelve a publicar.
- **"Correo o contraseña incorrectos":** revisa el usuario en Supabase → Authentication → Users.
- **"Este usuario existe pero no tiene acceso":** no se ejecutó bien `02_administrador.sql`, o el correo no coincide.
- **No se suben imágenes:** revisa que exista el bucket `vortex` (Parte 1, paso 7).

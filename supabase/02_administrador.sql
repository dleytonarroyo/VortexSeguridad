-- =====================================================================
--  VORTEX · SCRIPT 2 DE 2 · CONVERTIR TU USUARIO EN ADMINISTRADOR
--
--  Antes de ejecutarlo:
--  1. En Supabase ve a Authentication → Users → Add user → Create new user.
--  2. Escribe tu correo y tu contraseña, deja marcada la opción
--     "Auto Confirm User" y pulsa "Create user".
--  3. Cambia abajo  tu-correo@ejemplo.com  por ESE MISMO correo
--     (déjalo entre las comillas simples) y pulsa Run.
-- =====================================================================

insert into public.profiles (id, email, full_name, role, active)
select id, lower(email), 'Administrador', 'admin', true
from auth.users
where lower(email) = lower('tu-correo@ejemplo.com')
on conflict (id) do update set role = 'admin', active = true;

-- Comprobación: debe aparecer una fila con tu correo y el rol "admin".
-- Si no aparece ninguna fila, revisa que el correo esté bien escrito
-- y que el usuario exista en Authentication → Users.
select email, role, active from public.profiles where role = 'admin';

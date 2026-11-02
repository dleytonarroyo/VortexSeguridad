-- =====================================================================
--  VORTEX · ACTUALIZACIÓN 1.1
--  Para bases de datos que YA tienen instalado el script 01.
--  Supabase → SQL Editor → New query → pega todo → Run.
--  No borra ni modifica tus datos. Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Búsquedas más rápidas a medida que crecen los registros
create index if not exists payments_project_idx on public.payments(project_id);
create index if not exists expenses_project_idx on public.expenses(project_id);
create index if not exists purchases_project_idx on public.purchases(project_id);
create index if not exists purchase_items_purchase_idx on public.purchase_items(purchase_id);
create index if not exists project_installers_project_idx on public.project_installers(project_id);
create index if not exists installer_payments_pi_idx on public.installer_payments(project_installer_id);
create index if not exists checklist_items_project_idx on public.project_checklist_items(project_id);
create index if not exists template_items_template_idx on public.checklist_template_items(template_id);
create index if not exists tool_assignments_tool_idx on public.tool_assignments(tool_id);
create index if not exists quotation_versions_q_idx on public.quotation_versions(quotation_id);
create index if not exists price_history_product_idx on public.product_price_history(product_id);
create index if not exists audit_logs_at_idx on public.audit_logs(at desc);

-- 2. Siempre debe quedar al menos un administrador activo
create or replace function public.admin_update_user(p_user uuid, p_full_name text, p_role text, p_active boolean) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede modificar usuarios.'; end if;
  if p_role not in ('admin', 'operador') then raise exception 'Rol no válido.'; end if;
  if p_user = auth.uid() and (p_active = false or p_role <> 'admin') then
    raise exception 'No puedes quitarte el rol de administrador ni desactivarte a ti mismo.';
  end if;
  if (p_active = false or p_role <> 'admin')
     and exists (select 1 from public.profiles where id = p_user and role = 'admin' and active)
     and (select count(*) from public.profiles where role = 'admin' and active and id <> p_user) = 0 then
    raise exception 'Debe quedar al menos un administrador activo.';
  end if;
  update public.profiles set full_name = coalesce(p_full_name, full_name), role = p_role, active = p_active where id = p_user;
  update auth.users set banned_until = case when p_active then null else now() + interval '100 years' end, updated_at = now() where id = p_user;
  insert into public.audit_logs(user_email, text)
  values (coalesce((select email from public.profiles where id = auth.uid()), ''),
          'Usuario actualizado: ' || coalesce((select email from public.profiles where id = p_user), '') || ' (' || p_role || case when p_active then ', activo' else ', desactivado' end || ')');
end $$;

revoke execute on function public.admin_update_user(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_update_user(uuid, text, text, boolean) to authenticated;

-- 3. Registro de cambios de contraseña hechos por el administrador
create or replace function public.admin_reset_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede cambiar contraseñas.'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
  insert into public.audit_logs(user_email, text)
  values (coalesce((select email from public.profiles where id = auth.uid()), ''),
          'Contraseña cambiada para: ' || coalesce((select email from public.profiles where id = p_user), ''));
end $$;

revoke execute on function public.admin_reset_password(uuid, text) from public, anon;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;

-- Listo. Comprobación: debe mostrar "Actualización 1.1 aplicada".
select 'Actualización 1.1 aplicada' as resultado;

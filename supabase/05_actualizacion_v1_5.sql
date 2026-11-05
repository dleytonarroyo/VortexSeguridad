-- =====================================================================
--  VORTEX · ACTUALIZACIÓN 1.5 · FIRMA EN LAS COTIZACIONES
--  Para bases de datos que YA tienen instaladas las actualizaciones anteriores.
--  Supabase → SQL Editor → New query → pega todo → Run.
--  No borra ni modifica tus datos. Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Firma de cada empresa emisora (imagen y datos que van debajo)
alter table public.companies add column if not exists signature_path text;
alter table public.companies add column if not exists signer_name text not null default '';
alter table public.companies add column if not exists signer_title text not null default '';
alter table public.companies add column if not exists signer_extra text not null default '';

-- 2. Cada cotización puede incluir o no la firma
alter table public.quotations add column if not exists show_signature boolean not null default true;

-- 3. Guardar cotización incluyendo la opción de firma
create or replace function public.save_quotation(p_id uuid, p_header jsonb, p_items jsonb) returns void
language plpgsql set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'No tienes permiso para esta acción.'; end if;
  update public.quotations set
    company_id = (p_header->>'company_id')::uuid,
    client_id = nullif(p_header->>'client_id', '')::uuid,
    number = coalesce(nullif(p_header->>'number', ''), number),
    project_name = coalesce(p_header->>'project_name', ''),
    address = coalesce(p_header->>'address', ''),
    description = coalesce(p_header->>'description', ''),
    date = coalesce(nullif(p_header->>'date', '')::date, date),
    valid_until = nullif(p_header->>'valid_until', '')::date,
    terms = coalesce(p_header->>'terms', ''),
    commercial_notes = coalesce(p_header->>'commercial_notes', ''),
    internal_notes = coalesce(p_header->>'internal_notes', ''),
    g_disc_type = coalesce(nullif(p_header->>'g_disc_type', ''), '%'),
    g_disc_val = coalesce((p_header->>'g_disc_val')::numeric, 0),
    show_signature = coalesce((p_header->>'show_signature')::boolean, show_signature)
  where id = p_id;
  delete from public.quotation_items where quotation_id = p_id;
  insert into public.quotation_items (id, quotation_id, position, kind, service_kind, product_id, name, description, unit, qty, cost, markup, price, price_manual, disc_type, disc_val, show, image_path, distributed, supplier_id)
  select coalesce(x.id, gen_random_uuid()), p_id, coalesce(x.position, 0), x.kind, x.service_kind, x.product_id,
         coalesce(x.name, ''), coalesce(x.description, ''), coalesce(nullif(x.unit, ''), 'unidad'),
         coalesce(x.qty, 0), round(coalesce(x.cost, 0), 2), x.markup, round(coalesce(x.price, 0), 2), coalesce(x.price_manual, false),
         coalesce(nullif(x.disc_type, ''), '%'), coalesce(x.disc_val, 0), coalesce(x.show, true), x.image_path, coalesce(x.distributed, false), x.supplier_id
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(
    id uuid, position int, kind text, service_kind text, product_id uuid, name text, description text, unit text,
    qty numeric, cost numeric, markup numeric, price numeric, price_manual boolean, disc_type text, disc_val numeric,
    show boolean, image_path text, distributed boolean, supplier_id uuid);
end $$;

select 'Actualización 1.5 aplicada' as resultado;

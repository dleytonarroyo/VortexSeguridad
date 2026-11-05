-- =====================================================================
--  VORTEX · ACTUALIZACIÓN 1.6 · TAMAÑO DE PAPEL Y DUPLICADO INDEPENDIENTE
--  Para bases de datos que YA tienen instaladas las actualizaciones anteriores.
--  Supabase → SQL Editor → New query → pega todo → Run.
--  No borra ni modifica tus datos. Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Tamaño de papel de cada cotización (carta, oficio o A4)
alter table public.quotations add column if not exists paper_size text not null default 'carta';
alter table public.quotations drop constraint if exists quotations_paper_size_check;
alter table public.quotations add constraint quotations_paper_size_check check (paper_size in ('carta','oficio','a4'));

-- 2. Referencia a la cotización original cuando es una copia
alter table public.quotations add column if not exists copied_from uuid references public.quotations(id) on delete set null;

-- 3. Guardar cotización incluyendo el tamaño de papel
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
    show_signature = coalesce((p_header->>'show_signature')::boolean, show_signature),
    paper_size = coalesce(nullif(p_header->>'paper_size', ''), paper_size)
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

-- 4. Duplicar una cotización: crea una copia totalmente independiente
create or replace function public.duplicate_quotation(p_source uuid) returns uuid
language plpgsql set search_path = public as $$
declare
  v_src public.quotations%rowtype;
  v_id uuid := gen_random_uuid();
  v_prefix text;
  v_today date := (now() at time zone 'America/La_Paz')::date;
  v_days int;
begin
  if not public.is_staff() then raise exception 'No tienes permiso para esta acción.'; end if;
  select * into v_src from public.quotations where id = p_source;
  if not found then raise exception 'La cotización original no existe.'; end if;
  select prefix into v_prefix from public.companies where id = v_src.company_id;
  select coalesce(validity_days, 15) into v_days from public.app_settings where id = 1;

  insert into public.quotations (id, number, company_id, client_id, project_name, address, description, date, valid_until, terms,
    commercial_notes, internal_notes, status, g_disc_type, g_disc_val, show_signature, paper_size, copied_from)
  values (v_id, public.next_document_number(v_prefix), v_src.company_id, v_src.client_id, v_src.project_name, v_src.address,
    v_src.description, v_today, v_today + coalesce(v_days, 15), v_src.terms, v_src.commercial_notes, v_src.internal_notes,
    'borrador', v_src.g_disc_type, v_src.g_disc_val, v_src.show_signature, v_src.paper_size, v_src.id);

  insert into public.quotation_items (id, quotation_id, position, kind, service_kind, product_id, name, description, unit, qty, cost,
    markup, price, price_manual, disc_type, disc_val, show, image_path, distributed, supplier_id)
  select gen_random_uuid(), v_id, i.position, i.kind, i.service_kind, i.product_id, i.name, i.description, i.unit, i.qty, i.cost,
    i.markup, i.price, i.price_manual, i.disc_type, i.disc_val, i.show, i.image_path, i.distributed, i.supplier_id
  from public.quotation_items i where i.quotation_id = p_source;

  insert into public.audit_logs(user_email, text)
  values (coalesce((select email from public.profiles where id = auth.uid()), ''), 'Cotización ' || v_src.number || ' duplicada.');
  return v_id;
end $$;

select 'Actualización 1.6 aplicada' as resultado;

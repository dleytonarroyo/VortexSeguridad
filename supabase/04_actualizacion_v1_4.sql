-- =====================================================================
--  VORTEX · ACTUALIZACIÓN 1.4
--  Incluye: proveedor en las cotizaciones (1.3) y "costos aparte" (1.4)
--  Para bases de datos que YA tienen instalado el script 01.
--  Supabase → SQL Editor → New query → pega todo → Run.
--  No borra ni modifica tus datos. Se puede ejecutar más de una vez.
-- =====================================================================

-- 1. Nuevo campo "proveedor" en las líneas de cotización y de proyecto
alter table public.quotation_items add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
alter table public.project_items add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;
create index if not exists quotation_items_supplier_idx on public.quotation_items(supplier_id);

-- 2. Guardar cotización incluyendo el proveedor de cada línea
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
    g_disc_val = coalesce((p_header->>'g_disc_val')::numeric, 0)
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

-- 3. Al aceptar, el proveedor pasa también al presupuesto del proyecto
create or replace function public.accept_quotation(p_quotation uuid, p_template uuid, p_start date, p_data jsonb, p_company jsonb, p_client jsonb, p_totals jsonb)
returns uuid language plpgsql set search_path = public as $$
declare v_q public.quotations%rowtype; v_pid uuid := gen_random_uuid(); v_code text; v_n int;
begin
  if not public.is_staff() then raise exception 'No tienes permiso para esta acción.'; end if;
  select * into v_q from public.quotations where id = p_quotation for update;
  if not found then raise exception 'La cotización no existe.'; end if;
  if v_q.status = 'aceptada' then raise exception 'La cotización ya fue aceptada.'; end if;
  if v_q.deleted_at is not null then raise exception 'La cotización está en la papelera.'; end if;
  if v_q.client_id is null then raise exception 'La cotización no tiene cliente.'; end if;

  select coalesce(max(n), 0) + 1 into v_n from public.quotation_versions where quotation_id = p_quotation;
  insert into public.quotation_versions(quotation_id, n, reason, date, data, company, client)
  values (p_quotation, v_n, 'aceptada', (now() at time zone 'America/La_Paz')::date, p_data, p_company, p_client);

  v_code := public.next_document_number('PRY');
  insert into public.projects(id, code, name, quotation_id, company_id, client_id, address, planned_start, status, discount_amt, estimated_at_acceptance)
  values (v_pid, v_code, v_q.project_name, v_q.id, v_q.company_id, v_q.client_id, v_q.address, p_start,
          case when p_start is null then 'pendiente' else 'programado' end,
          coalesce((p_totals->>'gdisc')::numeric, 0), p_totals);

  insert into public.project_items(project_id, position, source_id, origin, kind, service_kind, product_id, name, description, unit, qty, cost, markup, price, disc_type, disc_val, show, billable, image_path, supplier_id)
  select v_pid, i.position, i.id, 'cotizacion', i.kind, i.service_kind, i.product_id, i.name, i.description, i.unit, i.qty, i.cost, i.markup, i.price, i.disc_type, i.disc_val, i.show, i.show, i.image_path, i.supplier_id
  from public.quotation_items i where i.quotation_id = p_quotation;

  insert into public.project_checklist_items(project_id, position, kind, label, qty, checked)
  select v_pid, i.position, 'material',
         i.name || ' (' || trim(trailing '.' from to_char(i.qty, 'FM999999990.###')) || ' ' || i.unit || ')', i.qty, false
  from public.quotation_items i where i.quotation_id = p_quotation and i.kind = 'producto';

  if p_template is not null then
    insert into public.project_checklist_items(project_id, position, kind, label, qty, checked)
    select v_pid, 1000 + t.position, t.kind, t.label, t.qty, false
    from public.checklist_template_items t where t.template_id = p_template;
  end if;

  update public.quotations set status = 'aceptada', project_id = v_pid where id = p_quotation;
  return v_pid;
end $$;

-- 4. Nuevo tipo de línea "costo aparte": costos internos que no se muestran al cliente
alter table public.quotation_items drop constraint if exists quotation_items_kind_check;
alter table public.quotation_items add constraint quotation_items_kind_check check (kind in ('producto','servicio','costo'));
alter table public.project_items drop constraint if exists project_items_kind_check;
alter table public.project_items add constraint project_items_kind_check check (kind in ('producto','servicio','costo'));

select 'Actualización 1.4 aplicada' as resultado;

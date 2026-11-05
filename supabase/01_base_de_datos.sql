-- =====================================================================
--  VORTEX · SCRIPT 1 DE 2 · BASE DE DATOS COMPLETA
--  Cópialo entero, pégalo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin dañar los datos existentes.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. USUARIOS Y PERMISOS
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'operador' check (role in ('admin','operador')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active and role = 'admin');
$$;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------------
-- 2. CONFIGURACIÓN Y NUMERACIÓN
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  default_markup numeric(7,2) not null default 40,
  validity_days int not null default 15,
  payment_terms text not null default '50 % de anticipo y 50 % contra entrega.',
  product_categories text[] not null default array['Cámaras IP','Cámaras analógicas','Grabadores','Almacenamiento','Redes','Cableado','Conectores','Energía','Accesorios','Monitores'],
  expense_categories text[] not null default array['Transporte','Alimentación','Alquiler de herramientas','Servicios externos','Materiales no inventariados','Mantenimiento de herramientas','Otros'],
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.document_counters (
  scope text primary key,
  last_value int not null default 0
);

-- ---------------------------------------------------------------------
-- 3. DATOS MAESTROS
-- ---------------------------------------------------------------------
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  trade_name text not null,
  legal_name text not null default '',
  tax_id text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  web text not null default '',
  contact text not null default '',
  prefix text not null unique,
  color text not null default '#7928CA',
  logo_path text,
  header_path text,
  terms text not null default '',
  footer text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  location text not null default '',
  tax_id text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text not null default '',
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  tax_id text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.installers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null default '',
  tax_id text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  category text not null default '',
  brand text not null default '',
  model text not null default '',
  unit text not null default 'unidad',
  item_type text not null default 'equipo' check (item_type in ('equipo','material','consumible')),
  ref_cost numeric(14,2) not null default 0 check (ref_cost >= 0),
  avg_cost numeric(14,2) not null default 0 check (avg_cost >= 0),
  markup numeric(7,2),
  pricing_mode text not null default 'incremento' check (pricing_mode in ('incremento','manual')),
  manual_price numeric(14,2) not null default 0 check (manual_price >= 0),
  min_stock numeric(12,3) not null default 0,
  supplier_id uuid references public.suppliers(id) on delete set null,
  description text not null default '',
  image_path text,
  active boolean not null default true,
  track_inventory boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  at timestamptz not null default now(),
  field text not null,
  from_value text,
  to_value text
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  brand text not null default '',
  model text not null default '',
  serial text not null default '',
  status text not null default 'disponible' check (status in ('disponible','prestada','en_mantenimiento','extraviada','de_baja')),
  location text not null default '',
  acquired date,
  image_path text,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.checklist_templates(id) on delete cascade,
  position int not null default 0,
  kind text not null default 'material' check (kind in ('material','herramienta')),
  label text not null,
  qty numeric(12,3)
);

-- ---------------------------------------------------------------------
-- 4. COTIZACIONES
-- ---------------------------------------------------------------------
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  company_id uuid not null references public.companies(id) on delete restrict,
  client_id uuid references public.clients(id) on delete restrict,
  project_name text not null default '',
  address text not null default '',
  description text not null default '',
  date date not null default current_date,
  valid_until date,
  terms text not null default '',
  commercial_notes text not null default '',
  internal_notes text not null default '',
  status text not null default 'borrador' check (status in ('borrador','enviada','aceptada','rechazada')),
  g_disc_type text not null default '%' check (g_disc_type in ('%','Bs')),
  g_disc_val numeric(14,2) not null default 0 check (g_disc_val >= 0),
  reject_reason text not null default '',
  deleted_at date,
  project_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trash_only_draft_or_rejected check (deleted_at is null or status in ('borrador','rechazada'))
);
create index if not exists quotations_status_idx on public.quotations(status);
create index if not exists quotations_client_idx on public.quotations(client_id);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  position int not null default 0,
  kind text not null check (kind in ('producto','servicio')),
  service_kind text,
  product_id uuid references public.products(id) on delete set null,
  name text not null default '',
  description text not null default '',
  unit text not null default 'unidad',
  qty numeric(12,3) not null default 0 check (qty >= 0),
  cost numeric(14,2) not null default 0 check (cost >= 0),
  markup numeric(7,2),
  price numeric(14,2) not null default 0 check (price >= 0),
  price_manual boolean not null default false,
  disc_type text not null default '%' check (disc_type in ('%','Bs')),
  disc_val numeric(14,2) not null default 0 check (disc_val >= 0),
  show boolean not null default true,
  image_path text,
  distributed boolean not null default false
);
create index if not exists quotation_items_q_idx on public.quotation_items(quotation_id);

create table if not exists public.quotation_versions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  n int not null,
  reason text not null check (reason in ('enviada','aceptada')),
  date date not null default current_date,
  data jsonb not null,
  company jsonb,
  client jsonb,
  created_at timestamptz not null default now(),
  unique (quotation_id, n)
);

-- ---------------------------------------------------------------------
-- 5. PROYECTOS
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null default '',
  quotation_id uuid not null unique references public.quotations(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  client_id uuid references public.clients(id) on delete restrict,
  address text not null default '',
  planned_start date,
  planned_end date,
  actual_start date,
  actual_end date,
  status text not null default 'pendiente' check (status in ('pendiente','programado','en_ejecucion','pausado','finalizado','cancelado')),
  discount_amt numeric(14,2) not null default 0,
  estimated_at_acceptance jsonb,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quotations_project_fk') then
    alter table public.quotations add constraint quotations_project_fk foreign key (project_id) references public.projects(id) on delete set null;
  end if;
end $$;

create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  position int not null default 0,
  source_id uuid,
  origin text not null default 'cotizacion' check (origin in ('cotizacion','adicional')),
  kind text not null default 'producto' check (kind in ('producto','servicio')),
  service_kind text,
  product_id uuid references public.products(id) on delete set null,
  name text not null default '',
  description text not null default '',
  unit text not null default 'unidad',
  qty numeric(12,3) not null default 0,
  cost numeric(14,2) not null default 0,
  markup numeric(7,2),
  price numeric(14,2) not null default 0,
  disc_type text not null default '%',
  disc_val numeric(14,2) not null default 0,
  show boolean not null default true,
  billable boolean not null default true,
  image_path text
);
create index if not exists project_items_p_idx on public.project_items(project_id);

create table if not exists public.project_checklist_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  position int not null default 0,
  kind text not null default 'material' check (kind in ('material','herramienta')),
  label text not null,
  qty numeric(12,3),
  checked boolean not null default false
);

create table if not exists public.project_installers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  installer_id uuid not null references public.installers(id) on delete restrict,
  agreed numeric(14,2) not null default 0 check (agreed >= 0),
  role text not null default '',
  unique (project_id, installer_id)
);

-- ---------------------------------------------------------------------
-- 6. INVENTARIO Y HERRAMIENTAS
-- ---------------------------------------------------------------------
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  supplier_id uuid references public.suppliers(id) on delete set null,
  reference text not null default '',
  destination text not null default 'almacen' check (destination in ('almacen','proyecto')),
  project_id uuid references public.projects(id) on delete restrict,
  total numeric(14,2) not null default 0,
  status text not null default 'pagada' check (status in ('pagada','pendiente','anulada')),
  paid_date date,
  receipt_path text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint purchase_project_required check (destination = 'almacen' or project_id is not null)
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(12,3) not null check (qty > 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  type text not null check (type in ('compra','entrada_manual','salida_proyecto','devolucion_proyecto','devolucion_proveedor','ajuste_positivo','ajuste_negativo')),
  product_id uuid not null references public.products(id) on delete restrict,
  qty numeric(12,3) not null check (qty > 0),
  unit_cost numeric(14,2) not null default 0,
  project_id uuid references public.projects(id) on delete restrict,
  purchase_id uuid references public.purchases(id) on delete restrict,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint movement_project_required check (type not in ('salida_proyecto','devolucion_proyecto') or project_id is not null)
);
create index if not exists movements_product_idx on public.inventory_movements(product_id);
create index if not exists movements_project_idx on public.inventory_movements(project_id);

create table if not exists public.tool_assignments (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  installer_id uuid references public.installers(id) on delete set null,
  assigned_at date not null default current_date,
  expected_return date,
  returned_at date,
  notes text not null default ''
);
create unique index if not exists one_open_assignment on public.tool_assignments(tool_id) where returned_at is null;

-- ---------------------------------------------------------------------
-- 7. FINANZAS
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete restrict,
  date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  type text not null default 'parcial' check (type in ('anticipo','parcial','final')),
  method text not null default 'Efectivo',
  reference text not null default '',
  receipt_path text,
  notes text not null default '',
  status text not null default 'vigente' check (status in ('vigente','anulado')),
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete restrict,
  category text not null default 'Otros',
  description text not null default '',
  amount numeric(14,2) not null check (amount > 0),
  date date not null default current_date,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'pagado' check (status in ('pagado','pendiente_pago','anulado')),
  paid_date date,
  receipt_path text,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.installer_payments (
  id uuid primary key default gen_random_uuid(),
  project_installer_id uuid not null references public.project_installers(id) on delete restrict,
  date date not null default current_date,
  amount numeric(14,2) not null check (amount > 0),
  method text not null default 'Efectivo',
  notes text not null default '',
  status text not null default 'vigente' check (status in ('vigente','anulado')),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  user_id uuid default auth.uid(),
  user_email text not null default '',
  text text not null
);

-- ---------------------------------------------------------------------
-- 8. REGLAS AUTOMÁTICAS (TRIGGERS)
-- ---------------------------------------------------------------------
drop trigger if exists companies_updated on public.companies;
create trigger companies_updated before update on public.companies for each row execute function public.set_updated_at();
drop trigger if exists products_updated on public.products;
create trigger products_updated before update on public.products for each row execute function public.set_updated_at();
drop trigger if exists quotations_updated on public.quotations;
create trigger quotations_updated before update on public.quotations for each row execute function public.set_updated_at();
drop trigger if exists projects_updated on public.projects;
create trigger projects_updated before update on public.projects for each row execute function public.set_updated_at();

create or replace function public.movement_dir(t text) returns int
language sql immutable as $$
  select case when t in ('compra','entrada_manual','devolucion_proyecto','ajuste_positivo') then 1 else -1 end;
$$;

-- El stock nunca puede quedar negativo
create or replace function public.check_stock() returns trigger
language plpgsql as $$
declare v_stock numeric;
begin
  if public.movement_dir(new.type) < 0 then
    perform pg_advisory_xact_lock(hashtext(new.product_id::text));
    select coalesce(sum(public.movement_dir(type) * qty), 0) into v_stock
      from public.inventory_movements where product_id = new.product_id;
    if v_stock - new.qty < 0 then
      raise exception 'Stock insuficiente: solo hay % disponibles.', trim(to_char(v_stock, 'FM999999990.###'));
    end if;
  end if;
  return new;
end $$;
drop trigger if exists movements_check_stock on public.inventory_movements;
create trigger movements_check_stock before insert on public.inventory_movements for each row execute function public.check_stock();

-- Historial de cambios de precio del catálogo
create or replace function public.log_price_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.ref_cost is distinct from old.ref_cost then
    insert into public.product_price_history(product_id, field, from_value, to_value) values (new.id, 'Costo de referencia', old.ref_cost::text, new.ref_cost::text);
  end if;
  if new.markup is distinct from old.markup then
    insert into public.product_price_history(product_id, field, from_value, to_value) values (new.id, 'Incremento', coalesce(old.markup::text, 'general'), coalesce(new.markup::text, 'general'));
  end if;
  if new.manual_price is distinct from old.manual_price or new.pricing_mode is distinct from old.pricing_mode then
    insert into public.product_price_history(product_id, field, from_value, to_value) values (new.id, 'Precio manual', old.pricing_mode || ' ' || old.manual_price::text, new.pricing_mode || ' ' || new.manual_price::text);
  end if;
  return new;
end $$;
drop trigger if exists products_price_history on public.products;
create trigger products_price_history after update on public.products for each row execute function public.log_price_change();

-- Una cotización aceptada no se puede modificar
create or replace function public.lock_accepted_quotation() returns trigger
language plpgsql as $$
begin
  if old.status = 'aceptada' then
    if new.status <> 'aceptada' or new.deleted_at is not null
       or row(new.company_id, new.client_id, new.number, new.g_disc_type, new.g_disc_val, new.project_name)
          is distinct from row(old.company_id, old.client_id, old.number, old.g_disc_type, old.g_disc_val, old.project_name) then
      raise exception 'La cotización ya fue aceptada y no se puede modificar.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists quotations_lock on public.quotations;
create trigger quotations_lock before update on public.quotations for each row execute function public.lock_accepted_quotation();

create or replace function public.lock_accepted_items() returns trigger
language plpgsql as $$
declare v_status text;
begin
  select status into v_status from public.quotations where id = coalesce(new.quotation_id, old.quotation_id);
  if v_status = 'aceptada' then
    raise exception 'La cotización ya fue aceptada y no se puede modificar.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists quotation_items_lock on public.quotation_items;
create trigger quotation_items_lock before insert or update or delete on public.quotation_items for each row execute function public.lock_accepted_items();

-- ---------------------------------------------------------------------
-- 9. OPERACIONES COMPLETAS (se ejecutan todo o nada)
-- ---------------------------------------------------------------------
create or replace function public.next_document_number(p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare v_year text := to_char(now() at time zone 'America/La_Paz', 'YYYY'); v_n int;
begin
  if not public.is_staff() then raise exception 'No tienes permiso para esta acción.'; end if;
  insert into public.document_counters(scope, last_value) values (p_prefix || '-' || v_year, 1)
  on conflict (scope) do update set last_value = public.document_counters.last_value + 1
  returning last_value into v_n;
  return p_prefix || '-' || v_year || '-' || lpad(v_n::text, 4, '0');
end $$;

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
  insert into public.quotation_items (id, quotation_id, position, kind, service_kind, product_id, name, description, unit, qty, cost, markup, price, price_manual, disc_type, disc_val, show, image_path, distributed)
  select coalesce(x.id, gen_random_uuid()), p_id, coalesce(x.position, 0), x.kind, x.service_kind, x.product_id,
         coalesce(x.name, ''), coalesce(x.description, ''), coalesce(nullif(x.unit, ''), 'unidad'),
         coalesce(x.qty, 0), round(coalesce(x.cost, 0), 2), x.markup, round(coalesce(x.price, 0), 2), coalesce(x.price_manual, false),
         coalesce(nullif(x.disc_type, ''), '%'), coalesce(x.disc_val, 0), coalesce(x.show, true), x.image_path, coalesce(x.distributed, false)
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(
    id uuid, position int, kind text, service_kind text, product_id uuid, name text, description text, unit text,
    qty numeric, cost numeric, markup numeric, price numeric, price_manual boolean, disc_type text, disc_val numeric,
    show boolean, image_path text, distributed boolean);
end $$;

create or replace function public.add_quotation_version(p_quotation uuid, p_reason text, p_data jsonb, p_company jsonb, p_client jsonb, p_set_status text)
returns int language plpgsql set search_path = public as $$
declare v_n int;
begin
  if not public.is_staff() then raise exception 'No tienes permiso para esta acción.'; end if;
  perform 1 from public.quotations where id = p_quotation for update;
  select coalesce(max(n), 0) + 1 into v_n from public.quotation_versions where quotation_id = p_quotation;
  insert into public.quotation_versions(quotation_id, n, reason, date, data, company, client)
  values (p_quotation, v_n, p_reason, (now() at time zone 'America/La_Paz')::date, p_data, p_company, p_client);
  if p_set_status is not null then
    update public.quotations set status = p_set_status where id = p_quotation;
  end if;
  return v_n;
end $$;

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

  insert into public.project_items(project_id, position, source_id, origin, kind, service_kind, product_id, name, description, unit, qty, cost, markup, price, disc_type, disc_val, show, billable, image_path)
  select v_pid, i.position, i.id, 'cotizacion', i.kind, i.service_kind, i.product_id, i.name, i.description, i.unit, i.qty, i.cost, i.markup, i.price, i.disc_type, i.disc_val, i.show, i.show, i.image_path
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

create or replace function public.register_purchase(p jsonb) returns uuid
language plpgsql set search_path = public as $$
declare
  v_id uuid := gen_random_uuid();
  v_dest text := coalesce(p->>'destination', 'almacen');
  v_proj uuid := nullif(p->>'project_id', '')::uuid;
  v_date date := coalesce(nullif(p->>'date', '')::date, current_date);
  v_update boolean := coalesce((p->>'update_ref')::boolean, false);
  v_total numeric := 0; v_stock numeric; v_avg numeric; it record;
begin
  if not public.is_staff() then raise exception 'No tienes permiso para esta acción.'; end if;
  if v_dest = 'proyecto' and v_proj is null then raise exception 'Selecciona el proyecto.'; end if;
  if jsonb_array_length(coalesce(p->'items', '[]'::jsonb)) = 0 then raise exception 'Agrega al menos un producto.'; end if;
  select coalesce(sum((x->>'qty')::numeric * round((x->>'unit_cost')::numeric, 2)), 0) into v_total from jsonb_array_elements(p->'items') x;

  insert into public.purchases(id, date, supplier_id, reference, destination, project_id, total, status, paid_date, receipt_path, notes)
  values (v_id, v_date, nullif(p->>'supplier_id', '')::uuid, coalesce(p->>'reference', ''), v_dest,
          case when v_dest = 'proyecto' then v_proj end, round(v_total, 2), coalesce(p->>'status', 'pagada'),
          case when coalesce(p->>'status', 'pagada') = 'pagada' then v_date end, nullif(p->>'receipt_path', ''), coalesce(p->>'notes', ''));

  for it in select (x->>'product_id')::uuid as pid, (x->>'qty')::numeric as qty, round((x->>'unit_cost')::numeric, 2) as cost
            from jsonb_array_elements(p->'items') x loop
    if it.qty is null or it.qty <= 0 then raise exception 'Las cantidades deben ser mayores que cero.'; end if;
    insert into public.purchase_items(purchase_id, product_id, qty, unit_cost) values (v_id, it.pid, it.qty, it.cost);
    select coalesce(sum(public.movement_dir(type) * qty), 0) into v_stock from public.inventory_movements where product_id = it.pid;
    select avg_cost into v_avg from public.products where id = it.pid for update;
    update public.products set
      avg_cost = case when greatest(v_stock, 0) + it.qty > 0
                      then round((greatest(v_stock, 0) * coalesce(v_avg, 0) + it.qty * it.cost) / (greatest(v_stock, 0) + it.qty), 2)
                      else it.cost end,
      ref_cost = case when v_update then it.cost else ref_cost end
    where id = it.pid;
    insert into public.inventory_movements(date, type, product_id, qty, unit_cost, purchase_id, notes)
    values (v_date, 'compra', it.pid, it.qty, it.cost, v_id, coalesce(p->>'reference', ''));
    if v_dest = 'proyecto' then
      insert into public.inventory_movements(date, type, product_id, qty, unit_cost, project_id, purchase_id, notes)
      values (v_date, 'salida_proyecto', it.pid, it.qty, it.cost, v_proj, v_id, 'Compra directa');
    end if;
  end loop;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 10. ADMINISTRACIÓN DE USUARIOS DESDE LA APLICACIÓN
-- ---------------------------------------------------------------------
create or replace function public.admin_create_user(p_email text, p_password text, p_full_name text, p_role text) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_id uuid := gen_random_uuid(); v_email text := lower(trim(p_email));
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede crear usuarios.'; end if;
  if p_role not in ('admin', 'operador') then raise exception 'Rol no válido.'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'El correo no es válido.'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres.'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'Ya existe un usuario con ese correo.'; end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', coalesce(p_full_name, '')), now(), now(),
    '', '', '', '', '', '', '', '');

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());

  insert into public.profiles(id, email, full_name, role, active) values (v_id, v_email, coalesce(p_full_name, ''), p_role, true);
  insert into public.audit_logs(user_email, text) values (coalesce((select email from public.profiles where id = auth.uid()), ''), 'Usuario creado: ' || v_email);
  return v_id;
end $$;

create or replace function public.admin_update_user(p_user uuid, p_full_name text, p_role text, p_active boolean) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede modificar usuarios.'; end if;
  if p_role not in ('admin', 'operador') then raise exception 'Rol no válido.'; end if;
  if p_user = auth.uid() and (p_active = false or p_role <> 'admin') then
    raise exception 'No puedes quitarte el rol de administrador ni desactivarte a ti mismo.';
  end if;
  update public.profiles set full_name = coalesce(p_full_name, full_name), role = p_role, active = p_active where id = p_user;
  update auth.users set banned_until = case when p_active then null else now() + interval '100 years' end, updated_at = now() where id = p_user;
end $$;

create or replace function public.admin_reset_password(p_user uuid, p_password text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede cambiar contraseñas.'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'La contraseña debe tener al menos 8 caracteres.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = p_user;
end $$;

revoke execute on function public.admin_create_user(text, text, text, text) from public, anon;
revoke execute on function public.admin_update_user(uuid, text, text, boolean) from public, anon;
revoke execute on function public.admin_reset_password(uuid, text) from public, anon;
grant execute on function public.admin_create_user(text, text, text, text) to authenticated;
grant execute on function public.admin_update_user(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_reset_password(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 11. SEGURIDAD: SOLO USUARIOS AUTORIZADOS VEN LOS DATOS (RLS)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['companies','clients','suppliers','installers','products','tools','checklist_templates',
    'checklist_template_items','quotation_items','project_items','project_checklist_items','project_installers',
    'purchases','purchase_items','tool_assignments','payments','expenses','installer_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists staff_all on public.%I', t);
    execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;

  -- Tablas de historial: solo se leen y se agregan registros, nunca se editan
  foreach t in array array['inventory_movements','quotation_versions','audit_logs','product_price_history'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists staff_select on public.%I', t);
    execute format('drop policy if exists staff_insert on public.%I', t);
    execute format('create policy staff_select on public.%I for select to authenticated using (public.is_staff())', t);
    execute format('create policy staff_insert on public.%I for insert to authenticated with check (public.is_staff())', t);
  end loop;
end $$;

alter table public.quotations enable row level security;
drop policy if exists q_select on public.quotations;
drop policy if exists q_insert on public.quotations;
drop policy if exists q_update on public.quotations;
drop policy if exists q_delete on public.quotations;
create policy q_select on public.quotations for select to authenticated using (public.is_staff());
create policy q_insert on public.quotations for insert to authenticated with check (public.is_staff());
create policy q_update on public.quotations for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy q_delete on public.quotations for delete to authenticated using (public.is_staff() and deleted_at is not null);

alter table public.projects enable row level security;
drop policy if exists p_select on public.projects;
drop policy if exists p_insert on public.projects;
drop policy if exists p_update on public.projects;
create policy p_select on public.projects for select to authenticated using (public.is_staff());
create policy p_insert on public.projects for insert to authenticated with check (public.is_staff());
create policy p_update on public.projects for update to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.app_settings enable row level security;
drop policy if exists s_select on public.app_settings;
drop policy if exists s_update on public.app_settings;
create policy s_select on public.app_settings for select to authenticated using (public.is_staff());
create policy s_update on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());

alter table public.document_counters enable row level security;

-- ---------------------------------------------------------------------
-- 12. ALMACENAMIENTO DE IMÁGENES Y COMPROBANTES (bucket privado "vortex")
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vortex', 'vortex', false, 10485760, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

drop policy if exists vortex_select on storage.objects;
drop policy if exists vortex_insert on storage.objects;
drop policy if exists vortex_update on storage.objects;
drop policy if exists vortex_delete on storage.objects;
create policy vortex_select on storage.objects for select to authenticated using (bucket_id = 'vortex' and public.is_staff());
create policy vortex_insert on storage.objects for insert to authenticated with check (bucket_id = 'vortex' and public.is_staff());
create policy vortex_update on storage.objects for update to authenticated using (bucket_id = 'vortex' and public.is_staff()) with check (bucket_id = 'vortex' and public.is_staff());
create policy vortex_delete on storage.objects for delete to authenticated using (bucket_id = 'vortex' and public.is_staff());

-- ---------------------------------------------------------------------
-- 13. DATOS INICIALES
-- ---------------------------------------------------------------------
insert into public.companies (trade_name, legal_name, address, phone, email, web, contact, prefix, color, logo_path, header_path, terms, footer)
select 'Vortex', 'Vortex Seguridad', 'Cochabamba, Bolivia', '+591 72291822', 'vortexmedia@gmail.com', 'www.vortexseguridad.com', '',
       'VTX', '#7928CA', '/brand/logo.jpg', '/brand/header.jpg', '50 % de anticipo y 50 % contra entrega.',
       'Garantía de 12 meses en equipos y 6 meses en instalación. Precios expresados en bolivianos.'
where not exists (select 1 from public.companies);

do $$
declare v_t uuid;
begin
  if not exists (select 1 from public.checklist_templates) then
    insert into public.checklist_templates(name, description) values ('Instalación CCTV estándar', 'Lista base para cualquier instalación de cámaras.') returning id into v_t;
    insert into public.checklist_template_items(template_id, position, kind, label)
    select v_t, ord, k, l from (values
      (1,'material','Materiales de fijación'), (2,'material','Cinta aislante y precintos'),
      (3,'herramienta','Crimpadora'), (4,'herramienta','Probador de red'), (5,'herramienta','Taladro'),
      (6,'herramienta','Brocas'), (7,'herramienta','Escalera'), (8,'herramienta','Herramientas manuales'),
      (9,'herramienta','Monitor de prueba'), (10,'herramienta','Elementos de protección personal')
    ) as v(ord, k, l);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 14. MEJORAS (versión 1.1)
-- ---------------------------------------------------------------------
-- 14.1 Búsquedas más rápidas a medida que crecen los registros
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

-- 14.2 Siempre debe quedar al menos un administrador activo
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

-- 14.3 Registro de cambios de contraseña hechos por el administrador
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

-- ---------------------------------------------------------------------
-- 15. PROVEEDOR EN LAS COTIZACIONES (versión 1.3)
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 16. COSTOS APARTE (versión 1.4)
-- ---------------------------------------------------------------------
-- 4. Nuevo tipo de línea "costo aparte": costos internos que no se muestran al cliente
alter table public.quotation_items drop constraint if exists quotation_items_kind_check;
alter table public.quotation_items add constraint quotation_items_kind_check check (kind in ('producto','servicio','costo'));
alter table public.project_items drop constraint if exists project_items_kind_check;
alter table public.project_items add constraint project_items_kind_check check (kind in ('producto','servicio','costo'));

-- ---------------------------------------------------------------------
-- 17. FIRMA EN LAS COTIZACIONES (versión 1.5)
-- ---------------------------------------------------------------------
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

-- Listo. Ahora ejecuta el SCRIPT 2 (02_administrador.sql).

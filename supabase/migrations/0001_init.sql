-- =====================================================================
-- ContaScan — Esquema inicial (Supabase / Postgres)
-- Modelo: contador -> cliente(flota) -> centro_costos(camión) -> factura
--         conductor -> centros asignados (conductor_centro)
-- Seguridad: Supabase Auth + RLS. El backend FastAPI NO toca la DB; el
-- frontend lee/escribe vía supabase-js con la sesión del usuario.
-- Aplicar en: Supabase Studio -> SQL Editor -> pegar y Run.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('contador', 'propietario', 'conductor');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles (1:1 con auth.users) — quién es cada usuario y su rol
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       user_role   not null default 'contador',
  nombre     text        not null default '',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- cliente — la flota/empresa que el contador administra (dueño opcional)
-- ---------------------------------------------------------------------
create table if not exists cliente (
  id             uuid primary key default gen_random_uuid(),
  contador_id    uuid not null references profiles(id) on delete cascade,
  propietario_id uuid references profiles(id) on delete set null,  -- login del dueño (opcional)
  nombre         text not null,
  nit            text default '',
  created_at     timestamptz not null default now()
);
create index if not exists cliente_contador_idx    on cliente(contador_id);
create index if not exists cliente_propietario_idx on cliente(propietario_id);

-- ---------------------------------------------------------------------
-- centro_costos — GENÉRICO (camión | proyecto | obra | sede)
-- ---------------------------------------------------------------------
create table if not exists centro_costos (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references cliente(id) on delete cascade,
  tipo          text not null default 'camion',
  identificador text default '',                       -- placa típicamente
  alias         text default '',
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists centro_cliente_idx on centro_costos(cliente_id);

-- ---------------------------------------------------------------------
-- conductor_centro — qué centros (camiones) reporta cada camionero (M:N)
-- ---------------------------------------------------------------------
create table if not exists conductor_centro (
  conductor_id     uuid not null references profiles(id) on delete cascade,
  centro_costos_id uuid not null references centro_costos(id) on delete cascade,
  primary key (conductor_id, centro_costos_id)
);

-- ---------------------------------------------------------------------
-- factura — el registro contable capturado (foto/voz). Campos del preset.
-- ---------------------------------------------------------------------
create table if not exists factura (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references cliente(id) on delete cascade,
  centro_costos_id uuid references centro_costos(id) on delete set null,
  capturada_por    uuid references profiles(id) on delete set null,
  -- campos del preset (presets/factura.py)
  tipo             text default '',           -- 'venta' | 'compra' | ''
  tercero          text default '',
  documento        text default '',
  numero           text default '',
  fecha            text default '',
  concepto         text default '',
  centro_costos_txt text default '',          -- texto crudo leído (placa) antes de mapear al FK
  medio_pago       text default '',
  subtotal         numeric default 0,
  impuestos        numeric default 0,
  total            numeric default 0,
  moneda           text default 'COP',
  texto_crudo      text default '',
  notas            text default '',
  confianza        numeric default 0,
  items            jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);
create index if not exists factura_cliente_idx on factura(cliente_id);
create index if not exists factura_centro_idx  on factura(centro_costos_id);
create index if not exists factura_fecha_idx    on factura(created_at);

-- ---------------------------------------------------------------------
-- Alta automática de profile al registrarse (lee nombre/role del signup)
-- ---------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nombre, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'contador')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- Helper: rol del usuario actual (security definer => evita recursión RLS)
-- ---------------------------------------------------------------------
create or replace function auth_role()
returns user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table profiles         enable row level security;
alter table cliente          enable row level security;
alter table centro_costos    enable row level security;
alter table conductor_centro enable row level security;
alter table factura          enable row level security;

-- ---- profiles -------------------------------------------------------
-- Cada quien ve/edita su propio profile. (El contador verá nombres de
-- sus dueños/conductores vía joins en las vistas de reporte.)
drop policy if exists profiles_self_select on profiles;
create policy profiles_self_select on profiles for select using (id = auth.uid());
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles for update using (id = auth.uid());

-- ---- cliente --------------------------------------------------------
-- Contador: dueño de sus clientes (full). Propietario: ve su cliente.
drop policy if exists cliente_contador_all on cliente;
create policy cliente_contador_all on cliente for all
  using (contador_id = auth.uid())
  with check (contador_id = auth.uid());

drop policy if exists cliente_propietario_select on cliente;
create policy cliente_propietario_select on cliente for select
  using (propietario_id = auth.uid());

-- Conductor: ve los clientes de los centros que tiene asignados.
drop policy if exists cliente_conductor_select on cliente;
create policy cliente_conductor_select on cliente for select
  using (exists (
    select 1 from conductor_centro cc
    join centro_costos cc2 on cc2.id = cc.centro_costos_id
    where cc.conductor_id = auth.uid() and cc2.cliente_id = cliente.id
  ));

-- ---- centro_costos --------------------------------------------------
-- Contador y propietario: full sobre los centros de sus clientes.
drop policy if exists centro_owner_all on centro_costos;
create policy centro_owner_all on centro_costos for all
  using (exists (
    select 1 from cliente c where c.id = centro_costos.cliente_id
      and (c.contador_id = auth.uid() or c.propietario_id = auth.uid())
  ))
  with check (exists (
    select 1 from cliente c where c.id = centro_costos.cliente_id
      and (c.contador_id = auth.uid() or c.propietario_id = auth.uid())
  ));

-- Conductor: ve los centros que tiene asignados.
drop policy if exists centro_conductor_select on centro_costos;
create policy centro_conductor_select on centro_costos for select
  using (exists (
    select 1 from conductor_centro cc
    where cc.centro_costos_id = centro_costos.id and cc.conductor_id = auth.uid()
  ));

-- ---- conductor_centro ----------------------------------------------
-- Contador/propietario gestionan asignaciones de sus centros.
drop policy if exists asignacion_owner_all on conductor_centro;
create policy asignacion_owner_all on conductor_centro for all
  using (exists (
    select 1 from centro_costos cc
    join cliente c on c.id = cc.cliente_id
    where cc.id = conductor_centro.centro_costos_id
      and (c.contador_id = auth.uid() or c.propietario_id = auth.uid())
  ))
  with check (exists (
    select 1 from centro_costos cc
    join cliente c on c.id = cc.cliente_id
    where cc.id = conductor_centro.centro_costos_id
      and (c.contador_id = auth.uid() or c.propietario_id = auth.uid())
  ));

-- Conductor: ve sus propias asignaciones.
drop policy if exists asignacion_conductor_select on conductor_centro;
create policy asignacion_conductor_select on conductor_centro for select
  using (conductor_id = auth.uid());

-- ---- factura --------------------------------------------------------
-- Ver: contador/propietario del cliente, o conductor del centro.
drop policy if exists factura_select on factura;
create policy factura_select on factura for select using (
  exists (
    select 1 from cliente c where c.id = factura.cliente_id
      and (c.contador_id = auth.uid() or c.propietario_id = auth.uid())
  )
  or exists (
    select 1 from conductor_centro cc
    where cc.centro_costos_id = factura.centro_costos_id and cc.conductor_id = auth.uid()
  )
);

-- Crear: contador/propietario del cliente, o conductor asignado al centro.
drop policy if exists factura_insert on factura;
create policy factura_insert on factura for insert with check (
  exists (
    select 1 from cliente c where c.id = factura.cliente_id
      and (c.contador_id = auth.uid() or c.propietario_id = auth.uid())
  )
  or exists (
    select 1 from conductor_centro cc
    where cc.centro_costos_id = factura.centro_costos_id and cc.conductor_id = auth.uid()
  )
);

-- Editar/borrar: contador/propietario del cliente, o el conductor que la capturó.
drop policy if exists factura_update on factura;
create policy factura_update on factura for update using (
  capturada_por = auth.uid()
  or exists (
    select 1 from cliente c where c.id = factura.cliente_id
      and (c.contador_id = auth.uid() or c.propietario_id = auth.uid())
  )
);
drop policy if exists factura_delete on factura;
create policy factura_delete on factura for delete using (
  capturada_por = auth.uid()
  or exists (
    select 1 from cliente c where c.id = factura.cliente_id
      and (c.contador_id = auth.uid() or c.propietario_id = auth.uid())
  )
);

-- =====================================================================
-- Vistas de reportes (gastos = facturas tipo 'compra')
-- security_invoker => respetan la RLS del usuario que consulta.
-- =====================================================================
create or replace view reporte_gastos_centro
  with (security_invoker = on) as
select
  cc.id            as centro_costos_id,
  cc.cliente_id,
  cc.alias,
  cc.identificador,
  cc.tipo,
  count(f.id)                  as num_facturas,
  coalesce(sum(f.total), 0)    as total_gastos,
  coalesce(sum(f.impuestos),0) as total_impuestos
from centro_costos cc
left join factura f on f.centro_costos_id = cc.id and f.tipo = 'compra'
group by cc.id;

create or replace view reporte_gastos_flota
  with (security_invoker = on) as
select
  c.id      as cliente_id,
  c.nombre,
  c.nit,
  count(distinct cc.id)        as num_centros,
  count(f.id)                  as num_facturas,
  coalesce(sum(f.total), 0)    as total_gastos
from cliente c
left join centro_costos cc on cc.cliente_id = c.id
left join factura f on f.cliente_id = c.id and f.tipo = 'compra'
group by c.id;

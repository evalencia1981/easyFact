-- =====================================================================
-- ContaScan — Migración 0002: manifiestos (viajes) y anticipos
-- Aplicar DESPUÉS de 0001. Idempotente (re-ejecutable).
--
-- Flujo: para viajar, el conductor tiene un MANIFIESTO (número) ligado a un
-- camión; se le da un ANTICIPO. Al terminar, sube facturas (gastos) y se
-- LIQUIDA el viaje: anticipo − gastos = saldo. (PDF/aprobación se difieren.)
-- =====================================================================

create table if not exists manifiesto (
  id               uuid primary key default gen_random_uuid(),
  cliente_id       uuid not null references cliente(id) on delete cascade,
  centro_costos_id uuid not null references centro_costos(id) on delete cascade,
  conductor_id     uuid references profiles(id) on delete set null,  -- conductor del viaje (opcional por ahora)
  numero           text not null,
  anticipo         numeric not null default 0,
  valor_viaje      numeric not null default 0,    -- lo que confirma el dueño (opcional)
  estado           text    not null default 'abierto',  -- 'abierto' | 'liquidado'
  created_at       timestamptz not null default now()
);
create index if not exists manifiesto_cliente_idx on manifiesto(cliente_id);
create index if not exists manifiesto_centro_idx  on manifiesto(centro_costos_id);

-- Vincular cada factura a su viaje (opcional) para la liquidación.
alter table factura add column if not exists manifiesto_id uuid references manifiesto(id) on delete set null;
create index if not exists factura_manifiesto_idx on factura(manifiesto_id);

-- ---------------------------------------------------------------------
-- RLS (reutiliza las funciones definer de 0001: my_cliente_ids, etc.)
-- ---------------------------------------------------------------------
alter table manifiesto enable row level security;

drop policy if exists manifiesto_owner_all on manifiesto;
create policy manifiesto_owner_all on manifiesto for all
  using (cliente_id in (select my_cliente_ids()))
  with check (cliente_id in (select my_cliente_ids()));

drop policy if exists manifiesto_conductor_select on manifiesto;
create policy manifiesto_conductor_select on manifiesto for select
  using (
    conductor_id = auth.uid()
    or centro_costos_id in (select my_conductor_centro_ids())
  );

-- ---------------------------------------------------------------------
-- Vista de liquidación por viaje (gastos = facturas tipo 'compra').
-- saldo = anticipo − gastos:  >0 sobró anticipo (devuelve);  <0 la empresa
-- le debe al conductor.  security_invoker => respeta RLS del que consulta.
-- ---------------------------------------------------------------------
create or replace view liquidacion_viaje
  with (security_invoker = on) as
select
  m.id               as manifiesto_id,
  m.cliente_id,
  m.centro_costos_id,
  m.conductor_id,
  m.numero,
  m.anticipo,
  m.valor_viaje,
  m.estado,
  m.created_at,
  cl.nombre          as cliente_nombre,
  cc.identificador   as camion_placa,
  cc.alias           as camion_alias,
  count(f.id)                                                  as num_facturas,
  coalesce(sum(f.total) filter (where f.tipo = 'compra'), 0)  as total_gastos,
  m.anticipo - coalesce(sum(f.total) filter (where f.tipo = 'compra'), 0) as saldo
from manifiesto m
join cliente cl       on cl.id = m.cliente_id
join centro_costos cc on cc.id = m.centro_costos_id
left join factura f   on f.manifiesto_id = m.id
group by m.id, cl.nombre, cc.identificador, cc.alias;

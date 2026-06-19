-- =====================================================================
-- ContaScan — Migración 0009: dos anticipos del viaje + link al PDF
-- Aplicar DESPUÉS de 0002. Idempotente.
--
-- - anticipo_manifiesto: el valor que trae el PDF del manifiesto (informativo).
-- - anticipo (existente): lo que el cliente ENTREGA al conductor; es el que se
--   cruza con los gastos en la liquidación (puede diferir del manifiesto).
-- - documento_url: link al PDF en un repositorio (Drive, etc.) para visualizarlo.
-- (No se captura el PDF con IA: se hace una vez por viaje, se digita.)
-- =====================================================================

alter table manifiesto add column if not exists anticipo_manifiesto numeric default 0;
alter table manifiesto add column if not exists documento_url       text default '';

-- La vista de liquidación expone ambos anticipos y el link; el saldo sigue
-- usando `anticipo` (lo entregado al conductor) vs total de facturas del viaje.
create or replace view liquidacion_viaje
  with (security_invoker = on) as
select
  m.id               as manifiesto_id,
  m.cliente_id,
  m.centro_costos_id,
  m.conductor_id,
  m.numero,
  m.origen,
  m.destino,
  m.anticipo,
  m.anticipo_manifiesto,
  m.valor_viaje,
  m.documento_url,
  m.estado,
  m.created_at,
  cl.nombre          as cliente_nombre,
  cc.identificador   as camion_placa,
  cc.alias           as camion_alias,
  count(f.id)                       as num_facturas,
  coalesce(sum(f.total), 0)         as total_gastos,
  m.anticipo - coalesce(sum(f.total), 0) as saldo
from manifiesto m
join cliente cl       on cl.id = m.cliente_id
join centro_costos cc on cc.id = m.centro_costos_id
left join factura f   on f.manifiesto_id = m.id
group by m.id, cl.nombre, cc.identificador, cc.alias;

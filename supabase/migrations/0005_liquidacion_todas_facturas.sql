-- =====================================================================
-- ContaScan — Migración 0005: liquidación cuenta TODAS las facturas del viaje
-- Aplicar DESPUÉS de 0002. Idempotente (create or replace view).
--
-- Antes: liquidacion_viaje sumaba solo facturas con tipo='compra'. Pero en un
-- viaje, CUALQUIER factura que sube el conductor es un gasto a cruzar contra el
-- anticipo (Gemini no siempre marca 'compra'). Se quita el filtro por tipo:
-- total_gastos = suma de TODAS las facturas ligadas al manifiesto.
-- =====================================================================

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
  m.valor_viaje,
  m.estado,
  m.created_at,
  cl.nombre          as cliente_nombre,
  cc.identificador   as camion_placa,
  cc.alias           as camion_alias,
  count(f.id)                       as num_facturas,
  coalesce(sum(f.total), 0)         as total_gastos,            -- TODAS las facturas del viaje
  m.anticipo - coalesce(sum(f.total), 0) as saldo
from manifiesto m
join cliente cl       on cl.id = m.cliente_id
join centro_costos cc on cc.id = m.centro_costos_id
left join factura f   on f.manifiesto_id = m.id
group by m.id, cl.nombre, cc.identificador, cc.alias;

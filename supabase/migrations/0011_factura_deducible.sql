-- =====================================================================
-- ContaScan — Migración 0011: marca deducible / no deducible en factura
-- Aplicar DESPUÉS de 0001. Idempotente.
--
-- Por defecto la factura es DEDUCIBLE. El contador (al revisar) puede marcarla
-- como NO deducible (típico de facturas/recibos a mano). Es una dimensión
-- contable: NO afecta la liquidación del viaje (el conductor igual gastó).
-- =====================================================================

alter table factura add column if not exists deducible boolean not null default true;

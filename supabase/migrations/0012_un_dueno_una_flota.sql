-- =====================================================================
-- ContaScan — Migración 0012: un dueño = una sola flota
-- Aplicar DESPUÉS de 0001. Idempotente.
--
-- Evita que el mismo dueño quede como propietario de varias flotas. Índice
-- único parcial sobre propietario_id (ignora los NULL = flotas sin dueño).
--
-- OJO: si ya existen DOS clientes con el mismo propietario_id, el índice NO se
-- creará hasta limpiar el duplicado (deja propietario_id en uno de ellos).
-- =====================================================================

create unique index if not exists cliente_propietario_unico
  on cliente (propietario_id)
  where propietario_id is not null;

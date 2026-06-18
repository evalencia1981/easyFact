-- =====================================================================
-- ContaScan — Migración 0006: mis_clientes() incluye el conteo de camiones
-- Aplicar DESPUÉS de 0003. Idempotente.
-- (Cambia la firma de retorno => drop + create.)
-- =====================================================================

drop function if exists mis_clientes();

create or replace function mis_clientes()
returns table(
  id uuid,
  nombre text,
  nit text,
  propietario_id uuid,
  propietario_nombre text,
  propietario_email text,
  num_camiones bigint
)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.nombre, c.nit, c.propietario_id, p.nombre, u.email,
    (select count(*) from public.centro_costos cc where cc.cliente_id = c.id)
  from public.cliente c
  left join public.profiles p on p.id = c.propietario_id
  left join auth.users u      on u.id = c.propietario_id
  where c.contador_id = auth.uid() or c.propietario_id = auth.uid()
  order by c.nombre
$$;

grant execute on function mis_clientes() to authenticated;

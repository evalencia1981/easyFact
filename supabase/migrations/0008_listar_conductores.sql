-- =====================================================================
-- ContaScan — Migración 0008: listar conductores registrados
-- Aplicar DESPUÉS de 0001. Idempotente.
--
-- Para asignar un conductor a un camión se elige de una LISTA de los que ya
-- están registrados (rol 'conductor'), en vez de escribir el correo a ciegas.
-- Lee auth.users (correo) => SECURITY DEFINER.
--
-- Nota (MVP): por ahora lista TODOS los conductores registrados. Si luego se
-- requiere acotar a un "pool" por flota/contador, se filtra aquí.
-- =====================================================================

create or replace function listar_conductores()
returns table(id uuid, nombre text, email text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre, u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'conductor'
  order by p.nombre, u.email
$$;

grant execute on function listar_conductores() to authenticated;

-- =====================================================================
-- ContaScan — Migración 0004: asignar Conductor a un camión (centro_costos)
-- Aplicar DESPUÉS de 0001/0002/0003. Idempotente.
--
-- El dueño/contador asigna un CONDUCTOR (registrado, rol 'conductor') a un
-- camión por su CORREO, para que ese conductor pueda subir las facturas del
-- camión. La asignación vive en conductor_centro (creada en 0001); su RLS
-- (asignacion_owner_all) ya deja al dueño/contador gestionarla. Aquí solo se
-- agregan los lookups por correo / nombre (auth.users) vía SECURITY DEFINER.
-- =====================================================================

-- Buscar un conductor por correo (solo perfiles con rol 'conductor').
create or replace function buscar_conductor(p_email text)
returns table(id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(trim(p_email)) and p.role = 'conductor'
$$;

-- Conductores asignados a un camión que administra el usuario (contador/dueño).
create or replace function conductores_de_centro(p_centro uuid)
returns table(conductor_id uuid, nombre text, email text)
language sql stable security definer set search_path = public as $$
  select k.conductor_id, p.nombre, u.email
  from public.conductor_centro k
  join public.profiles p      on p.id = k.conductor_id
  join auth.users u           on u.id = k.conductor_id
  join public.centro_costos cc on cc.id = k.centro_costos_id
  join public.cliente cl       on cl.id = cc.cliente_id
  where k.centro_costos_id = p_centro
    and (cl.contador_id = auth.uid() or cl.propietario_id = auth.uid())
$$;

grant execute on function buscar_conductor(text) to authenticated;
grant execute on function conductores_de_centro(uuid) to authenticated;

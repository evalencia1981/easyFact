-- =====================================================================
-- ContaScan — Migración 0003: vincular Dueño (propietario) a un cliente
-- Aplicar DESPUÉS de 0001/0002. Idempotente.
--
-- El contador asigna el dueño de un cliente escribiendo su CORREO. El dueño
-- debe estar registrado (rol 'propietario'); si no, se registra él mismo.
-- profiles no guarda el correo, así que estas funciones leen auth.users; por
-- eso son SECURITY DEFINER (no exponen toda la tabla, solo lo necesario).
-- =====================================================================

-- Buscar un dueño por correo (solo perfiles con rol 'propietario').
create or replace function buscar_propietario(p_email text)
returns table(id uuid, nombre text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nombre
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(trim(p_email)) and p.role = 'propietario'
$$;

-- Clientes del usuario (contador o propietario) + datos del dueño vinculado.
create or replace function mis_clientes()
returns table(
  id uuid,
  nombre text,
  nit text,
  propietario_id uuid,
  propietario_nombre text,
  propietario_email text
)
language sql stable security definer set search_path = public as $$
  select c.id, c.nombre, c.nit, c.propietario_id, p.nombre, u.email
  from public.cliente c
  left join public.profiles p  on p.id = c.propietario_id
  left join auth.users u       on u.id = c.propietario_id
  where c.contador_id = auth.uid() or c.propietario_id = auth.uid()
  order by c.nombre
$$;

grant execute on function buscar_propietario(text) to authenticated;
grant execute on function mis_clientes() to authenticated;

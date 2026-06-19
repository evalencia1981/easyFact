-- =====================================================================
-- ContaScan — Migración 0007: conectar contador a la flota de un dueño
-- Aplicar DESPUÉS de 0003. Idempotente.
--
-- Objetivo: una sola flota por dueño, compartida. Cuando el contador agrega un
-- dueño por correo, NO se crea un cliente vacío: se REUTILIZA la flota que el
-- dueño ya tiene (visible solo vía SECURITY DEFINER) y se conecta poniéndose
-- como contador; el dueño queda como propietario. Si el dueño no tiene flota,
-- se crea una compartida (contador + propietario).
--
-- Nota de seguridad (MVP): permite a un contador "tomar" la flota de un dueño
-- por su correo (aprobación del dueño se difiere, como acordamos). El dueño
-- conserva acceso vía propietario_id.
-- =====================================================================

create or replace function conectar_dueno(p_email text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_dueno   uuid;
  v_nombre  text;
  v_cliente uuid;
begin
  -- 1) Buscar el dueño (rol propietario) por correo.
  select p.id, p.nombre into v_dueno, v_nombre
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(u.email) = lower(trim(p_email)) and p.role = 'propietario';

  if v_dueno is null then
    return null;  -- no registrado como dueño
  end if;

  -- 2) Flota existente del dueño: como propietario, o auto-creada por él
  --    (contador_id = dueño, sin propietario asignado).
  select id into v_cliente
  from public.cliente
  where propietario_id = v_dueno
     or (contador_id = v_dueno and propietario_id is null)
  order by created_at
  limit 1;

  if v_cliente is not null then
    -- 3a) Conectar: este contador la gestiona; el dueño es el propietario.
    update public.cliente
      set contador_id = auth.uid(), propietario_id = v_dueno
      where id = v_cliente;
  else
    -- 3b) El dueño no tiene flota: crear una compartida.
    insert into public.cliente (contador_id, propietario_id, nombre)
      values (auth.uid(), v_dueno, coalesce(nullif(v_nombre, ''), 'Flota'))
      returning id into v_cliente;
  end if;

  return v_cliente;
end $$;

grant execute on function conectar_dueno(text) to authenticated;

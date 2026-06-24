-- =====================================================================
-- ContaScan — Migración 0014: datos de empresa del dueño (para el Informe Anual)
-- Aplicar DESPUÉS de 0006. Idempotente.
--
-- El Informe Anual (por dueño de camión) necesita la identificación de la
-- empresa: NOMBRE, NIT, DIRECCION y CIUDAD. Ya teníamos nombre/nit; aquí
-- agregamos direccion y ciudad al cliente (= la flota/empresa del dueño).
--
-- Como el dueño (propietario) solo tiene SELECT sobre cliente (ver RLS 0001),
-- exponemos un RPC SECURITY DEFINER para que ÉL o su CONTADOR puedan editar
-- estos 4 campos de identificación (y nada más).
-- =====================================================================

alter table cliente add column if not exists direccion text not null default '';
alter table cliente add column if not exists ciudad    text not null default '';

-- mis_clientes() ahora devuelve también direccion y ciudad (cambia la firma => drop + create).
drop function if exists mis_clientes();

create or replace function mis_clientes()
returns table(
  id uuid,
  nombre text,
  nit text,
  direccion text,
  ciudad text,
  propietario_id uuid,
  propietario_nombre text,
  propietario_email text,
  num_camiones bigint
)
language sql stable security definer set search_path = public as $$
  select
    c.id, c.nombre, c.nit, c.direccion, c.ciudad,
    c.propietario_id, p.nombre, u.email,
    (select count(*) from public.centro_costos cc where cc.cliente_id = c.id)
  from public.cliente c
  left join public.profiles p on p.id = c.propietario_id
  left join auth.users u      on u.id = c.propietario_id
  where c.contador_id = auth.uid() or c.propietario_id = auth.uid()
  order by c.nombre
$$;

grant execute on function mis_clientes() to authenticated;

-- Editar la identificación de la empresa: solo el contador o el dueño de ESE cliente.
create or replace function actualizar_empresa(
  p_cliente   uuid,
  p_nombre    text,
  p_nit       text,
  p_direccion text,
  p_ciudad    text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.cliente
     set nombre    = coalesce(p_nombre, nombre),
         nit       = coalesce(p_nit, nit),
         direccion = coalesce(p_direccion, direccion),
         ciudad    = coalesce(p_ciudad, ciudad)
   where id = p_cliente
     and (contador_id = auth.uid() or propietario_id = auth.uid());

  if not found then
    raise exception 'No puedes editar esta empresa: no eres su contador ni su dueño.';
  end if;
end $$;

grant execute on function actualizar_empresa(uuid, text, text, text, text) to authenticated;

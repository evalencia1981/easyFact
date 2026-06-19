-- =====================================================================
-- ContaScan — Migración 0013: el contador se desvincula de una flota
-- Aplicar DESPUÉS de 0001/0003. Idempotente.
--
-- "Quitar de mi gestión": el contador deja de gestionar un cliente que TIENE
-- dueño, sin borrar nada. La flota vuelve a quedar a cargo del dueño
-- (contador_id = propietario_id). El contador deja de verla; el dueño la
-- conserva con todos sus camiones/viajes/facturas.
--
-- Va en SECURITY DEFINER porque el RLS (with check contador_id = auth.uid())
-- no deja a un contador poner contador_id en otro usuario.
-- =====================================================================

create or replace function desvincular_contador(p_cliente uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_prop uuid;
begin
  -- Solo el contador actual de ese cliente, y debe tener dueño.
  select propietario_id into v_prop
  from public.cliente
  where id = p_cliente and contador_id = auth.uid();

  if v_prop is null then
    raise exception 'No puedes desvincular: no eres el contador de este cliente o no tiene dueño.';
  end if;

  update public.cliente set contador_id = v_prop where id = p_cliente;
end $$;

grant execute on function desvincular_contador(uuid) to authenticated;

-- =====================================================================
-- ContaScan — Migración 0010: bucket de Storage para PDFs de manifiestos
-- Aplicar en Supabase. Idempotente.
--
-- Permite subir el PDF del manifiesto desde el explorador. Bucket PÚBLICO
-- (los PDFs se ven por su URL; el path es un UUID no adivinable). Subir/editar/
-- borrar requiere sesión (rol authenticated).
--
-- Nota (MVP): bucket público por simplicidad. Si luego se quiere privado, se
-- cambia a public=false y se sirve con signed URLs.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('manifiestos', 'manifiestos', true)
on conflict (id) do update set public = true;

-- Usuarios autenticados pueden subir/leer/actualizar/borrar en este bucket.
drop policy if exists manifiestos_auth_rw on storage.objects;
create policy manifiestos_auth_rw on storage.objects
  for all to authenticated
  using (bucket_id = 'manifiestos')
  with check (bucket_id = 'manifiestos');

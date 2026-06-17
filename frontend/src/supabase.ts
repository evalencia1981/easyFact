import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // No tumbamos la app: se ve un aviso y la pantalla de login mostrará el error.
  console.warn("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en frontend/.env");
}

// Cliente único de Supabase (Auth + datos). La llave anon es pública; la
// seguridad la dan las políticas RLS del esquema.
export const supabase = createClient(url ?? "", anon ?? "");

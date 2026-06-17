# Supabase — base de datos de ContaScan

Backend de datos del MVP. **Auth + RLS de Supabase**: el frontend (supabase-js) lee/escribe con
la sesión del usuario; el backend FastAPI sigue **stateless** (solo extracción con Gemini).

## Modelo
```
contador ──< cliente (flota) ──< centro_costos (camión, genérico) ──< factura
conductor ──< conductor_centro >── centro_costos        (asignación M:N)
profiles 1:1 auth.users (role: contador | propietario | conductor)
```
Reportes (vistas): `reporte_gastos_centro` (por camión) y `reporte_gastos_flota` (por cliente).

## Aplicar el esquema
1. Crea un proyecto en https://supabase.com (free tier).
2. **SQL Editor → New query** → pega el contenido de [`migrations/0001_init.sql`](migrations/0001_init.sql) → **Run**.
3. **Settings → API**: copia `Project URL` y la llave `anon public`.

## Llaves para el frontend
En `frontend/.env` (ver `frontend/.env.example`):
```
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```
> La llave `anon` es pública por diseño (va en el navegador); la seguridad real la dan las
> políticas **RLS** del esquema, no el secreto de la llave.

## Roles al registrarse
El trigger `handle_new_user` crea el `profile` leyendo `nombre` y `role` del metadata del signup
(`supabase.auth.signUp({ ..., options: { data: { nombre, role } } })`). `role` por defecto: `contador`.

# contascan-intake

**ContaScan**: MVP para capturar **facturas y apuntes** desde **foto** o **dictado por voz/texto**.
La IA (Google Gemini) los lee, el usuario los **revisa/edita** y **confirma**.

Sigue la arquitectura base Loggro/Reparte: **frontend React + backend FastAPI desplegados
juntos en Vercel**. El navegador llama a `/api/*` del **mismo origen**; el núcleo reutilizable
`intake/{gemini,extractor,chat,schema}.py` se copia **tal cual**.

## Stack
- **Frontend**: React + Vite + Tailwind (TypeScript) — `frontend/`
- **Backend**: Python + **FastAPI** (ASGI) — endpoints `/api/*`
- **IA**: **Google Gemini** (`gemini-2.5-flash`, free tier) vía REST — structured outputs
- **Deploy**: **Vercel** (`vercel.json`: build del frontend + función `api/index.py`)
- Sin DB, sin estado: cada request es independiente

## Fases
| Fase | Entregable | Estado |
|---|---|---|
| **I0** | Núcleo copiado + `/health` responde | ✅ |
| **I1** | Preset **flexible** `presets/factura.py` (`FACTURA_SCHEMA`, `extraer_factura`, `conversar_factura`) | ✅ |
| **I2** | `POST /extraer`, `POST /chat` + auth `X-Intake-Key` | ✅ |
| **MVP** | Frontend React (foto + voz → editar/confirmar) + backend `/api/*` | ✅ |
| **I3** | Deploy en **Vercel** + URL pública (`vercel.json`) | ⏳ |

> **Auth:** en el MVP same-origin el navegador llama a `/api/*` sin `X-Intake-Key` (igual que
> Reparte). El gate `require_intake_key` queda listo en `backend/app.py` para reactivarlo si otra
> app consume el servicio server-to-server.
>
> **Nota de diseño:** se omitió el esquema DIAN rígido (CUFE/DV/UBL). Los insumos reales son
> apuntes/notas que se leen, así que el preset usa un **esquema laxo** con casi todo opcional;
> lo único obligatorio es `texto_crudo` (transcripción literal), que siempre se puede producir.

## Correr en local
Dos procesos (backend y frontend), desde la raíz del repo:
```bash
# 1) Backend (FastAPI) en :8000
python -m pip install -r requirements.txt
# copia .env.example a .env y pon GEMINI_API_KEY
python -m uvicorn backend.app:app --reload --port 8000

# 2) Frontend (Vite) en :5173 — proxya /api -> :8000
cd frontend && npm install && npm run dev
# abre http://127.0.0.1:5173
```

## Deploy en Vercel (fase I3)
El repo trae `vercel.json` (build del frontend + función ASGI `api/index.py`). Pasos:

1. El repo ya está en **GitHub** (`evalencia1981/easyFact`).
2. En Vercel: **Add New → Project** → importa el repo. Detecta `vercel.json`.
3. En **Settings → Environment Variables**, agrega `GEMINI_API_KEY` con el valor real.
4. **Deploy**. La URL pública sirve el frontend y `/api/*` en el mismo origen.
   Verifica `https://<tu-proyecto>.vercel.app/api/health`.

> El filesystem de Vercel es **solo-lectura** en runtime: este servicio es stateless, así que
> no hay problema. `render.yaml` se conserva por si se prefiere desplegar el backend en Render.

## Estructura
```
intake/                  núcleo reutilizable (NO modificar): gemini, extractor, chat, schema
presets/                 preset del dominio (factura/apunte flexible) — fase I1
backend/app.py           FastAPI: /api/health + /api/extraer + /api/chat (+ auth opcional)
api/index.py             entrypoint ASGI (Vercel) — copiar tal cual
frontend/                React + Vite + Tailwind (MVP)
  src/components/         ImagenUpload.tsx, ChatCaptura.tsx (núcleo, copiados tal cual)
  src/api.ts             llamadas a /api/* (dominio factura)
  src/App.tsx            pantalla: captura (foto/voz) -> editar -> confirmar
vercel.json              deploy en Vercel (frontend dist + api/index.py) — fase I3
render.yaml              alternativa: deploy del backend en Render
```

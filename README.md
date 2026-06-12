# contascan-intake

Servicio de captura de **ContaScan**: microservicio **stateless** (sin base de datos) que
expone el motor reutilizable `intake` (Google Gemini) por HTTP para extraer datos de
**facturas DIAN** desde **foto** o **chat por voz/texto**.

Reúsa el núcleo del proyecto Loggro/Reparte (`intake/{gemini,extractor,chat,schema}.py`,
copiados **tal cual**). La app SaaS ContaScan lo consume **server-side** — el navegador
nunca llama a este servicio directamente.

## Stack
- Python + **FastAPI** (ASGI)
- **Google Gemini** (`gemini-2.5-flash`, free tier) vía REST — structured outputs
- Sin DB, sin estado: cada request es independiente

## Fases
| Fase | Entregable | Estado |
|---|---|---|
| **I0** | Núcleo copiado + `/health` responde | ✅ |
| **I1** | `presets/factura_dian.py` (`FACTURA_DIAN_SCHEMA`, `extraer_factura`, `conversar_factura`) | ⏳ |
| **I2** | `POST /extraer`, `POST /chat` + auth `X-Intake-Key` | ⏳ |
| **I3** | Deploy en Railway/Render/Fly + URL pública | ⏳ |

## Correr en local
```bash
python -m pip install -r requirements.txt
# copia .env.example a .env y pon GEMINI_API_KEY (e INTAKE_SERVICE_KEY desde I2)
python -m uvicorn backend.app:app --reload --port 8000
# http://127.0.0.1:8000/health
```

## Estructura
```
intake/        núcleo reutilizable (NO modificar): gemini, extractor, chat, schema
presets/       presets del dominio (factura DIAN) — fase I1
backend/app.py FastAPI (health; endpoints en I2)
api/index.py   entrypoint ASGI (compatibilidad con el patrón original)
```

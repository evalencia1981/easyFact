"""
backend/app.py — Servicio de captura de ContaScan (contascan-intake).

Microservicio STATELESS (sin base de datos): expone el motor reutilizable `intake`
(Gemini) por HTTP para extraer datos de facturas DIAN desde foto o chat. La app SaaS
ContaScan lo consume server-side (el navegador nunca lo llama directo).

Fases (detenerse al final de cada una):
  I0 (ACTUAL) — núcleo `intake` copiado tal cual + /health.
  I1 — preset factura DIAN (presets/factura_dian.py).
  I2 — endpoints /extraer y /chat + auth por header X-Intake-Key == INTAKE_SERVICE_KEY.
  I3 — deploy en Railway/Render/Fly.

Correr local:  uvicorn backend.app:app --reload --port 8000   (desde la raíz)
"""
from __future__ import annotations

import os
import sys

from fastapi import FastAPI

# Permitir importar el paquete `intake` desde la raíz del repo.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from intake import model_name  # noqa: E402

app = FastAPI(title="ContaScan Intake", version="0.1.0")


@app.get("/health")
def health():
    """Liveness del servicio. No requiere autenticación."""
    return {
        "ok": True,
        "service": "contascan-intake",
        "model": model_name(),
        "gemini_key": bool(os.getenv("GEMINI_API_KEY")),
    }

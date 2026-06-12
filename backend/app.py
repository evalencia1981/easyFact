"""
backend/app.py — Servicio de captura de ContaScan (contascan-intake).

Microservicio STATELESS (sin base de datos): expone el motor reutilizable `intake`
(Gemini) por HTTP para extraer datos de facturas/apuntes desde foto o chat. La app SaaS
ContaScan lo consume server-side (el navegador nunca lo llama directo) enviando el header
X-Intake-Key.

Fases (detenerse al final de cada una):
  I0 — núcleo `intake` copiado tal cual + /health.                                  ✅
  I1 — preset FLEXIBLE de factura/apunte (presets/factura.py).                       ✅
  I2 (ACTUAL) — endpoints /extraer y /chat + auth por header X-Intake-Key.
  I3 — deploy en Railway/Render/Fly.

Correr local:  uvicorn backend.app:app --reload --port 8000   (desde la raíz)
"""
from __future__ import annotations

import os
import secrets
import sys
from typing import Optional

from fastapi import Depends, FastAPI, File, HTTPException, Security, UploadFile
from fastapi.security import APIKeyHeader
from pydantic import BaseModel

# Permitir importar `intake` y `presets` desde la raíz del repo.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from intake import media_type_from_name, model_name  # noqa: E402
import presets  # noqa: E402

app = FastAPI(title="ContaScan Intake", version="0.1.0")


# --------------------------------------------------------------------------- #
# Auth interna: todo endpoint de captura exige X-Intake-Key == INTAKE_SERVICE_KEY
# --------------------------------------------------------------------------- #
_intake_key_header = APIKeyHeader(name="X-Intake-Key", auto_error=False)


def require_intake_key(x_intake_key: Optional[str] = Security(_intake_key_header)) -> None:
    expected = os.getenv("INTAKE_SERVICE_KEY")
    if not expected:
        raise HTTPException(503, "INTAKE_SERVICE_KEY no configurada en el servicio.")
    if not x_intake_key or not secrets.compare_digest(x_intake_key, expected):
        raise HTTPException(401, "X-Intake-Key inválida o ausente.")


# --------------------------------------------------------------------------- #
# Modelos
# --------------------------------------------------------------------------- #
class ChatTurn(BaseModel):
    role: str
    content: str


class ChatReq(BaseModel):
    mensaje: str
    estado: Optional[dict] = None
    historial: list[ChatTurn] = []


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@app.get("/health")
def health():
    """Liveness del servicio. Público (sin auth)."""
    return {
        "ok": True,
        "service": "contascan-intake",
        "model": model_name(),
        "gemini_key": bool(os.getenv("GEMINI_API_KEY")),
        "intake_key_set": bool(os.getenv("INTAKE_SERVICE_KEY")),
    }


@app.post("/extraer", dependencies=[Depends(require_intake_key)])
async def extraer(file: UploadFile = File(...)):
    """Foto de una factura/apunte -> {data, confidence}. Requiere X-Intake-Key."""
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(400, "Falta GEMINI_API_KEY en el servicio.")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Archivo vacío.")
    media = media_type_from_name(file.filename or "doc.jpg")
    try:
        doc = presets.extraer_factura(data, media)
    except Exception as e:
        raise HTTPException(502, f"Error extrayendo el documento: {e}")
    return {"data": doc, "confidence": doc.get("confianza", 0)}


@app.post("/chat", dependencies=[Depends(require_intake_key)])
def chat(req: ChatReq):
    """Turno de chat (voz/texto) -> {data, respuesta}. Requiere X-Intake-Key."""
    if not (req.mensaje or "").strip():
        raise HTTPException(400, "Mensaje vacío.")
    if not os.getenv("GEMINI_API_KEY"):
        raise HTTPException(400, "Falta GEMINI_API_KEY en el servicio.")
    try:
        return presets.conversar_factura(
            req.mensaje, estado=req.estado,
            historial=[t.model_dump() for t in req.historial],
        )
    except Exception as e:
        raise HTTPException(502, f"Error en el chat: {e}")

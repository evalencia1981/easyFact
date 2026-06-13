"""
backend/app.py — API FastAPI de ContaScan (MVP con frontend).

Sigue la arquitectura base Loggro/Reparte: frontend (React/Vite) y backend
(FastAPI vía api/index.py) se despliegan JUNTOS en Vercel. El navegador llama a
`/api/*` del MISMO origen, así que los endpoints de IA solo requieren GEMINI_API_KEY
(no hay X-Intake-Key en el camino del navegador).

> Nota: la captura headless server-to-server (cuando otra app consuma este servicio)
> puede protegerse con `X-Intake-Key` reintroduciendo `require_intake_key` como
> dependencia. Para el MVP same-origin se deja desactivado.

Endpoints (IA, solo requieren GEMINI_API_KEY):
  GET  /api/health
  POST /api/extraer   (foto -> {data, confidence})
  POST /api/chat      (voz/texto con estado -> {data, respuesta})

Correr local:  uvicorn backend.app:app --reload --port 8000   (desde la raíz)
"""
from __future__ import annotations

import os
import secrets
import sys
from typing import Optional

from fastapi import FastAPI, File, HTTPException, Security, UploadFile
from fastapi.middleware.cors import CORSMiddleware
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

app = FastAPI(title="ContaScan Intake", version="0.2.0")

# El frontend en dev corre en Vite (5173) y proxya /api al backend (8000); en
# producción (Vercel) frontend y API comparten origen y este CORS es inocuo.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Auth opcional (server-to-server). NO se usa en el MVP same-origin; se deja
# lista para proteger la captura headless cuando otra app consuma el servicio:
# añade `dependencies=[Depends(require_intake_key)]` al endpoint que la requiera.
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
# Endpoints de IA (solo requieren GEMINI_API_KEY)
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health():
    """Liveness del servicio."""
    return {
        "ok": True,
        "service": "contascan-intake",
        "model": model_name(),
        "gemini_key": bool(os.getenv("GEMINI_API_KEY")),
    }


@app.post("/api/extraer")
async def extraer(file: UploadFile = File(...)):
    """Foto de una factura/apunte -> {data, confidence}."""
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


@app.post("/api/chat")
def chat(req: ChatReq):
    """Turno de chat (voz/texto) -> {data, respuesta}."""
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

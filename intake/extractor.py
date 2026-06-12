"""
intake.extractor — Extracción genérica de datos desde una imagen (visión).

Recibe bytes de una imagen + un esquema + un prompt y devuelve el dict que cumple
el esquema. Reutilizable para cualquier tipo de documento (factura, recibo, etc.).
"""
from __future__ import annotations

import base64

from .gemini import generar_json


def extraer_imagen(image_bytes: bytes, schema: dict, prompt: str,
                   media_type: str = "image/jpeg") -> dict:
    """Genérico: extrae de una imagen los datos que cumplan `schema`, guiado por `prompt`."""
    b64 = base64.standard_b64encode(image_bytes).decode("utf-8")
    parts = [
        {"inline_data": {"mime_type": media_type, "data": b64}},
        {"text": prompt},
    ]
    return generar_json(parts, schema)

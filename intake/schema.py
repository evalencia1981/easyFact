"""
intake.schema — Helpers de esquema/medios compartidos por el motor.

Los esquemas concretos de cada documento viven en `presets/`. Recuerda: el
responseSchema de Gemini es un subconjunto de OpenAPI y NO admite additionalProperties.
"""
from __future__ import annotations

MEDIA_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}


def media_type_from_name(filename: str) -> str:
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    return MEDIA_TYPES.get(ext, "image/jpeg")

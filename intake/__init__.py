"""
intake — Motor reutilizable de captura por foto y chat (Gemini).

Copiado TAL CUAL del proyecto Loggro/Reparte. NO modificar gemini/extractor/chat/schema:
son el núcleo genérico. Los presets concretos (esquema + prompt de cada documento) viven
en el paquete `presets/` (ver presets/factura_dian.py — fase I1).

Genéricos:
    from intake import (
        generar_json, model_name, extraer_imagen, conversar_doc, media_type_from_name,
    )
"""
from .gemini import generar_json, model_name
from .extractor import extraer_imagen
from .chat import conversar_doc
from .schema import media_type_from_name

__all__ = [
    "generar_json",
    "model_name",
    "extraer_imagen",
    "conversar_doc",
    "media_type_from_name",
]

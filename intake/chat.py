"""
intake.chat — Captura/edición de un documento por conversación (lenguaje natural / dictado).

Genérico: se le pasa el ESTADO ACTUAL del documento (JSON) y el MENSAJE nuevo del usuario,
y devuelve el documento COMPLETO actualizado + una `respuesta` breve para el chat. Mantiene
estado turno a turno. Reutilizable para cualquier documento pasando esquema + system prompt.
"""
from __future__ import annotations

import json
from typing import Optional

from .gemini import generar_json


def conversar_doc(mensaje: str, doc_schema: dict, system_prompt: str,
                  estado: Optional[dict] = None, historial: Optional[list[dict]] = None,
                  etiqueta_doc: str = "DOCUMENTO") -> dict:
    """Un turno de chat que construye/actualiza un documento que cumple `doc_schema`.

    Devuelve {"data": <dict del documento>, "respuesta": <str>}.
    """
    wrap_schema = {
        "type": "object",
        "properties": {"data": doc_schema, "respuesta": {"type": "string"}},
        "required": ["data", "respuesta"],
    }
    lineas_hist = ""
    if historial:
        lineas_hist = "\n".join(
            f"{h.get('role', 'user')}: {h.get('content', '')}" for h in historial[-8:]
        )
    prompt = (
        f"{system_prompt}\n\n"
        f"ESTADO ACTUAL DEL {etiqueta_doc} (JSON):\n{json.dumps(estado or {}, ensure_ascii=False)}\n\n"
        + (f"CONVERSACIÓN PREVIA:\n{lineas_hist}\n\n" if lineas_hist else "")
        + f"MENSAJE NUEVO DEL USUARIO:\n{mensaje}"
    )
    return generar_json([{"text": prompt}], wrap_schema)

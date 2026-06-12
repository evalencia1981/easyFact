"""
presets — Presets del dominio ContaScan montados sobre el motor genérico `intake`.

Esquema FLEXIBLE (no DIAN rígido): los insumos suelen ser apuntes/notas que se leen.
Ver presets/factura.py.
"""
from .factura import (
    FACTURA_SCHEMA,
    extraer_factura,
    conversar_factura,
)

__all__ = [
    "FACTURA_SCHEMA",
    "extraer_factura",
    "conversar_factura",
]

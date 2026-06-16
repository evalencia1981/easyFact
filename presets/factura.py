"""
presets.factura — Preset FLEXIBLE de captura para ContaScan.

NO es el esquema DIAN rígido (CUFE/DV/UBL): los insumos reales suelen ser apuntes o
notas sueltas que se leen, no facturas electrónicas estructuradas. Por eso el esquema
es laxo: casi todo es OPCIONAL y lo único que se exige es `texto_crudo` (la transcripción
literal de lo que se ve), que siempre se puede producir aunque no se infiera ningún campo.

Recuerda: el responseSchema de Gemini es un subconjunto de OpenAPI y NO admite
`additionalProperties`. Todos los campos van en `properties`; `required` solo los mínimos.

API pública (estable para la app ContaScan):
    extraer_factura(image_bytes, media_type) -> {... , "texto_crudo", "confianza"}
    conversar_factura(mensaje, estado, historial) -> {"data": {...}, "respuesta": str}
"""
from __future__ import annotations

from typing import Optional

from intake.extractor import extraer_imagen
from intake.chat import conversar_doc

# --------------------------------------------------------------------------- #
# Esquema flexible: factura formal O apunte a mano. Casi todo opcional.
# --------------------------------------------------------------------------- #
FACTURA_SCHEMA = {
    "type": "object",
    "properties": {
        # Quién y cuándo (todo opcional: puede ser solo un nombre garabateado).
        "tipo": {"type": "string"},          # "venta" | "compra" | "" si no se infiere
        "tercero": {"type": "string"},       # nombre del cliente o proveedor
        "documento": {"type": "string"},     # NIT/cédula del tercero, si aparece
        "numero": {"type": "string"},        # número de factura/recibo, si aparece
        "fecha": {"type": "string"},         # fecha tal como se vea (texto libre)
        "concepto": {"type": "string"},      # descripción general del movimiento
        "placa": {"type": "string"},         # placa del vehículo, si aparece (parqueaderos, peajes,
                                             # combustible, mantenimiento...). Opcional pero relevante.

        # Detalle opcional. Cada línea con sus propios campos opcionales.
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "descripcion": {"type": "string"},
                    "cantidad": {"type": "number"},
                    "valor_unitario": {"type": "number"},
                    "total_linea": {"type": "number"},
                },
                "required": ["descripcion"],
            },
        },

        # Importes. Si no aparecen, 0. No se obliga ninguno.
        "subtotal": {"type": "number"},
        "impuestos": {"type": "number"},
        "total": {"type": "number"},
        "moneda": {"type": "string"},        # default "COP" si no se especifica

        # Respaldo y control de calidad.
        "texto_crudo": {"type": "string"},   # transcripción LITERAL de lo leído (OBLIGATORIO)
        "notas": {"type": "string"},         # cualquier cosa que no encaje en los campos
        "confianza": {"type": "number"},     # autoevaluación 0..1 de qué tan legible/completo
    },
    "required": ["texto_crudo"],
}


PROMPT_IMG = """Eres un asistente contable que lee documentos de cobro/pago en Colombia.
La imagen puede ser una factura formal O un APUNTE/NOTA a mano (cuentas por cobrar). Extrae al
esquema JSON lo que REALMENTE se ve. Reglas:
- `texto_crudo` (OBLIGATORIO): transcribe LITERALMENTE todo el texto/números que logres leer,
  tal cual aparece. Es el respaldo aunque no puedas estructurar nada más.
- Rellena los demás campos SOLO si están presentes o son claramente inferibles. Si un campo
  numérico no aparece, usa 0; si un texto no aparece, usa "". NO inventes datos.
- `items`: una línea por concepto que se distinga. Cada línea solo necesita `descripcion`;
  agrega `cantidad`, `valor_unitario` o `total_linea` si se ven.
- `tipo`: "venta" si es un cobro a un cliente, "compra" si es un gasto/pago a un proveedor;
  "" si no se puede determinar.
- `placa`: si aparece una placa de vehículo (común en parqueaderos, peajes, combustible,
  mantenimiento, lavado), transcríbela tal cual (ej. "NUU699", "ABC123"). Si no aparece, "".
- `total`: el valor total a cobrar/pagar si está visible o es sumable con confianza.
- `moneda`: "COP" por defecto en Colombia salvo que se indique otra.
- `confianza`: número 0..1 con tu autoevaluación de qué tan legible y completo quedó
  (0.9+ factura nítida y completa; 0.5 apunte parcialmente legible; bajo si dudoso).
Devuelve solo el JSON del esquema."""

SYSTEM_CHAT = """Eres un asistente contable que arma un registro de factura/apunte conversando
(voz o texto), para cuentas por cobrar en Colombia. Recibes (1) el ESTADO ACTUAL del registro
(JSON) y (2) el MENSAJE nuevo del usuario. Actualiza el registro y devuelve el registro COMPLETO
+ una `respuesta` breve y natural.

Reglas:
- El documento es FLEXIBLE: puede empezar como un apunte ("le vendí 200.000 a Pedro ayer") e ir
  completándose. Mantén lo previo salvo que el usuario lo cambie.
- `texto_crudo`: acumula/resume lo que el usuario va dictando (es el respaldo en lenguaje natural).
- `monto`/importes: interpreta "doscientos mil" = 200000, "200k" = 200000. Si falta el total o el
  tercero, pídelo en la `respuesta`.
- `tipo`: "venta" si es un cobro a un cliente; "compra" si es un pago a un proveedor.
- `placa`: si el usuario menciona una placa de vehículo, regístrala (ej. "NUU699"); si no, "".
- `moneda`: "COP" por defecto. No inventes datos; si algo no se dijo, déjalo vacío/0.
- `confianza`: tu autoevaluación 0..1 de qué tan completo está el registro.
Devuelve solo el JSON del esquema (data = registro + respuesta)."""


def _vacio() -> dict:
    return {
        "tipo": "", "tercero": "", "documento": "", "numero": "", "fecha": "",
        "concepto": "", "placa": "", "items": [], "subtotal": 0, "impuestos": 0,
        "total": 0, "moneda": "COP", "texto_crudo": "", "notas": "", "confianza": 0,
    }


def extraer_factura(image_bytes: bytes, media_type: str = "image/jpeg") -> dict:
    """Foto de una factura o apunte -> dict flexible (FACTURA_SCHEMA)."""
    return extraer_imagen(image_bytes, FACTURA_SCHEMA, PROMPT_IMG, media_type)


def conversar_factura(mensaje: str, estado: Optional[dict] = None,
                      historial: Optional[list[dict]] = None) -> dict:
    """Un turno de chat para construir/editar el registro. Devuelve {"data": ..., "respuesta": ...}."""
    out = conversar_doc(
        mensaje, FACTURA_SCHEMA, SYSTEM_CHAT,
        estado=estado or _vacio(), historial=historial, etiqueta_doc="FACTURA",
    )
    return {"data": out.get("data") or _vacio(), "respuesta": out.get("respuesta", "")}

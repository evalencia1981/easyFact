"""
api/index.py — Entrypoint ASGI genérico (patrón heredado de Loggro/Reparte).

Reexporta la app FastAPI para plataformas que esperan `api.index:app`. El deploy
objetivo (fase I3) es Railway/Render/Fly con `uvicorn backend.app:app`; este archivo
se mantiene por compatibilidad con el patrón del motor original.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import app  # noqa: E402,F401

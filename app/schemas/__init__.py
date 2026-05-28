# app/schemas/__init__.py
"""
Módulo de Esquemas del Sistema.
Exporta todos los esquemas de validación de Pydantic V2 para ser consumidos
fácilmente en los enrutadores y controladores de la API.
"""

from app.schemas.reporte import ReporteBase, ReporteCreate, ReporteUpdate, ReporteResponse
from app.schemas.usuario import UsuarioBase, UsuarioCreate, UsuarioLogin, UsuarioResponse, Token
from app.schemas.comentario import ComentarioBase, ComentarioCreate, ComentarioResponse
from app.schemas.historial import HistorialEstadosBase, HistorialEstadosResponse

__all__ = [
    "ReporteBase",
    "ReporteCreate",
    "ReporteUpdate",
    "ReporteResponse",
    "UsuarioBase",
    "UsuarioCreate",
    "UsuarioLogin",
    "UsuarioResponse",
    "Token",
    "ComentarioBase",
    "ComentarioCreate",
    "ComentarioResponse",
    "HistorialEstadosBase",
    "HistorialEstadosResponse"
]

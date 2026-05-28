# app/models/__init__.py
"""
Módulo de Modelos del Sistema.
Exporta todas las clases SQLAlchemy para que sean cargadas automáticamente
y registradas en los metadatos globales (Base.metadata).
"""

from app.models.reporte import Base, ReporteModel
from app.models.usuario import UsuarioModel
from app.models.comentario import ComentarioModel
from app.models.historial import HistorialEstadosModel

__all__ = [
    "Base",
    "ReporteModel",
    "UsuarioModel",
    "ComentarioModel",
    "HistorialEstadosModel"
]

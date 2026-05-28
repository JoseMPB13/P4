# app/schemas/historial.py
"""
Módulo de Esquemas de Pydantic para el Historial de Estados (DTOs).
Responsabilidad: Estructurar la salida de auditoría de cambios de estado
de las incidencias de infraestructura.
"""

from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class HistorialEstadosBase(BaseModel):
    """
    Clase base con campos comunes para el historial de estados.
    """
    estado_anterior: str = Field(..., description="Estado previo del reporte", examples=["pendiente"])
    estado_nuevo: str = Field(..., description="Estado nuevo asignado al reporte", examples=["en proceso"])

class HistorialEstadosResponse(HistorialEstadosBase):
    """
    DTO para dar formato de respuesta al listar el historial de auditoría.
    """
    id: int = Field(..., description="Identificador único de la auditoría")
    reporte_id: int = Field(..., description="ID del reporte asociado")
    usuario_id: int = Field(..., description="ID del usuario que realizó la modificación")
    cambiado_en: datetime = Field(..., description="Fecha y hora exacta del cambio de estado")

    model_config = ConfigDict(from_attributes=True)

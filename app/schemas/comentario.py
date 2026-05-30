# app/schemas/comentario.py
"""
Módulo de Esquemas de Pydantic para Comentarios (DTOs).
Responsabilidad: Validar la entrada y salida de datos para la entidad comentarios
vinculada al historial y trazabilidad técnica.
"""

from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict

class ComentarioBase(BaseModel):
    """
    Clase base con campos comunes para la entidad Comentario.
    """
    texto: str = Field(
        ...,
        description="Texto o nota descriptiva del comentario",
        examples=["Se revisará la tubería principal mañana a primera hora."]
    )

class ComentarioCreate(ComentarioBase):
    """
    DTO utilizado para validar el payload al crear un comentario (POST).
    """
    reporte_id: int = Field(..., description="ID del reporte asociado", examples=[1])
    usuario_id: int = Field(..., description="ID del usuario que comenta", examples=[1])

    @field_validator("texto")
    @classmethod
    def validar_texto_no_vacio(cls, valor: str) -> str:
        """
        Validador para evitar comentarios vacíos.
        """
        if not valor or not valor.strip():
            raise ValueError("El texto del comentario no puede estar vacío.")
        return valor.strip()

from app.schemas.usuario import UsuarioResponse
from typing import Optional

class ComentarioResponse(ComentarioBase):
    """
    DTO para dar formato de respuesta a la consulta de comentarios.
    """
    id: int = Field(..., description="Identificador único del comentario")
    reporte_id: int = Field(..., description="ID del reporte asociado")
    usuario_id: int = Field(..., description="ID del usuario que comenta")
    creado_en: datetime = Field(..., description="Fecha y hora de creación")
    usuario: Optional[UsuarioResponse] = Field(default=None, description="Información del usuario que escribió el comentario")

    # Configuración de Pydantic V2 para habilitar carga de atributos ORM
    model_config = ConfigDict(from_attributes=True)

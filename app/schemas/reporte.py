# app/schemas/reporte.py
"""
Capa de Esquemas (Pydantic).
Responsabilidad: Validar los datos de entrada en las solicitudes HTTP y dar formato
a los datos de salida de las respuestas de la API.

Este archivo define los modelos de Pydantic que actúan como DTOs (Data Transfer Objects)
para la entidad "Reporte". Contiene validaciones detalladas y comentarios educativos
en español.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, ConfigDict

class ReporteBase(BaseModel):
    """
    Clase base para la entidad Reporte. Define la estructura de datos común.
    """
    titulo: str = Field(
        ...,
        description="Título descriptivo del reporte de infraestructura",
        examples=["Gotera en techo de laboratorio de química"]
    )
    descripcion: str = Field(
        ...,
        description="Descripción detallada de la incidencia u observación",
        examples=["Se filtra agua del piso superior justo sobre el tomacorriente de la pared este."]
    )
    tipo_problema: str = Field(
        ...,
        description="Categoría o tipo de problema de infraestructura (ej. gotera, daño eléctrico)",
        examples=["gotera"]
    )
    ubicacion: str = Field(
        ...,
        description="Ubicación física dentro del campus universitario",
        examples=["Edificio de Ciencias Básicas, Laboratorio 102"]
    )
    imagen_url: Optional[str] = Field(
        None,
        description="URL opcional de una imagen de respaldo para la incidencia",
        examples=["https://mi-storage.universidad.edu.bo/reportes/gotera102.jpg"]
    )

class ReporteCreate(ReporteBase):
    """
    Esquema utilizado para validar el payload al crear un reporte (POST).
    Hereda de ReporteBase, por lo que hereda todos sus campos obligatorios.
    """
    
    # Validadores personalizados usando la sintaxis moderna de Pydantic V2 (@field_validator)
    @field_validator("titulo")
    @classmethod
    def validar_titulo_no_vacio(cls, valor: str) -> str:
        """
        Validador para asegurar que el título no esté vacío ni contenga solo espacios en blanco.
        Explicación: .strip() elimina espacios al inicio y al final. Si la longitud resultante
        es cero, significa que el campo venía vacío o con solo espacios.
        """
        if not valor or not valor.strip():
            raise ValueError("El título es obligatorio y no puede estar vacío ni contener solo espacios en blanco.")
        return valor.strip()

    @field_validator("ubicacion")
    @classmethod
    def validar_ubicacion_no_vacio(cls, valor: str) -> str:
        """
        Validador para asegurar que la ubicación no esté vacía ni contenga solo espacios en blanco.
        """
        if not valor or not valor.strip():
            raise ValueError("La ubicación es obligatoria y no puede estar vacía ni contener solo espacios en blanco.")
        return valor.strip()


class ReporteUpdate(BaseModel):
    """
    Esquema utilizado para la actualización de un reporte (PUT / PATCH).
    Permite modificar opcionalmente los campos de prioridad y estado.
    """
    # Ambos campos son opcionales (tienen valor por defecto None)
    prioridad: Optional[str] = Field(
        None,
        description="Prioridad asignada al reporte: baja, media, alta",
        examples=["alta"]
    )
    estado: Optional[str] = Field(
        None,
        description="Estado del ciclo de vida del reporte: pendiente, en proceso, resuelto",
        examples=["en proceso"]
    )

    # Validadores de contenido para asegurar valores permitidos (Simulación de enums)
    @field_validator("prioridad")
    @classmethod
    def validar_prioridad_enum(cls, valor: Optional[str]) -> Optional[str]:
        """
        Validador de prioridad: Asegura que si se envía prioridad,
        sea exactamente uno de los valores válidos: 'baja', 'media' o 'alta'.
        """
        if valor is not None:
            valores_validos = ["baja", "media", "alta"]
            if valor not in valores_validos:
                raise ValueError(f"La prioridad debe ser una de las siguientes: {', '.join(valores_validos)}")
        return valor

    @field_validator("estado")
    @classmethod
    def validar_estado_enum(cls, valor: Optional[str]) -> Optional[str]:
        """
        Validador de estado: Asegura que si se envía el estado,
        sea exactamente uno de los valores permitidos: 'pendiente', 'en proceso' o 'resuelto'.
        """
        if valor is not None:
            valores_validos = ["pendiente", "en proceso", "resuelto"]
            if valor not in valores_validos:
                raise ValueError(f"El estado debe ser uno de los siguientes: {', '.join(valores_validos)}")
        return valor


class ReporteResponse(ReporteBase):
    """
    Esquema utilizado para dar formato a la respuesta JSON que retorna la API.
    Añade los metadatos de control generados por el servidor.
    """
    id: int = Field(..., description="Identificador único del reporte autoincrementado por la base de datos")
    prioridad: str = Field(..., description="Prioridad actual del reporte (baja, media, alta)")
    estado: str = Field(..., description="Estado actual de resolución del reporte")
    creado_en: datetime = Field(..., description="Fecha y hora exactas de creación del reporte en el servidor")

    # Configuración de Pydantic V2 para soportar la carga desde modelos ORM (como SQLAlchemy)
    model_config = ConfigDict(from_attributes=True)

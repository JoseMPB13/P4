# app/models/reporte.py
"""
Capa de Modelos (SQLAlchemy ORM).
Responsabilidad: Representar la estructura física de la base de datos relacional.
Define la clase que mapea directamente con la tabla "reportes" en PostgreSQL u
otro motor relacional compatible con SQLAlchemy.

Este archivo incluye comentarios detallados sobre cada columna y propiedad
para servir de material de estudio y referencia académica.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base

# Declarative Base: Es la clase base a partir de la cual heredan todos nuestros
# modelos ORM. Realiza el registro automático de las clases mapeadas con la base de datos.
Base = declarative_base()

class ReporteModel(Base):
    """
    Modelo de datos que representa la tabla 'reportes' en la base de datos relacional.
    Usa SQLAlchemy para definir el mapeo Objeto-Relacional (ORM).
    """
    # Nombre exacto de la tabla física que se creará en la base de datos relacional
    __tablename__ = "reportes"

    # id: Llave primaria (primary_key=True) de tipo entero.
    # index=True crea un índice en esta columna para búsquedas rápidas.
    # autoincrement=True le indica al motor de base de datos que incremente su valor automáticamente (Serial/Identity).
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # titulo: Título resumido de la falla. Tipo String con límite de 100 caracteres.
    # nullable=False indica que es obligatorio a nivel de base de datos (no nulo).
    titulo = Column(String(100), nullable=False)

    # descripcion: Explicación detallada. Tipo String con límite de 500 caracteres, no nulo.
    descripcion = Column(String(500), nullable=False)

    # tipo_problema: Clasificación del problema (ej. "gotera", "daño eléctrico").
    # Permite catalogar los reportes de manera estructurada. No nulo.
    tipo_problema = Column(String(50), nullable=False)

    # ubicacion: Campus, pabellón, aula, etc. No nulo.
    ubicacion = Column(String(200), nullable=False)

    # imagen_url: Enlace opcional a una foto que documente el problema.
    # nullable=True indica que se permite almacenar valores NULL en la base de datos.
    imagen_url = Column(String(255), nullable=True)

    # prioridad: Nivel de urgencia. String con valor por defecto de 'media'.
    # default="media" se aplica a nivel de aplicación cuando guardamos un registro sin especificar la prioridad.
    prioridad = Column(String(20), default="media", nullable=False)

    # estado: Estado del reporte (pendiente, en proceso, resuelto).
    # default="pendiente" asegura que todo nuevo reporte inicie en este estado. No nulo.
    estado = Column(String(20), default="pendiente", nullable=False)

    # default=lambda: datetime.now(timezone.utc) asigna la hora UTC actual cuando se instancia el objeto.
    creado_en = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self) -> str:
        """
        Método mágico para representar el objeto en logs y depuración interactiva.
        """
        return f"<ReporteModel id={self.id} titulo='{self.titulo}' tipo='{self.tipo_problema}' estado='{self.estado}'>"

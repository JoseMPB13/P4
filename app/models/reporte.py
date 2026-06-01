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
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

# Declarative Base
Base = declarative_base()

class ReporteModel(Base):
    """
    Modelo de datos que representa la tabla 'reportes' en la base de datos relacional.
    Usa SQLAlchemy para definir el mapeo Objeto-Relacional (ORM) y llaves foráneas.
    """
    __tablename__ = "reportes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    titulo = Column(String(100), nullable=False)
    descripcion = Column(String(500), nullable=False)
    tipo_problema = Column(String(50), nullable=False)
    ubicacion = Column(String(200), nullable=False)
    imagen_url = Column(String(255), nullable=True)
    prioridad = Column(String(20), default="media", nullable=False)
    estado = Column(String(20), default="pendiente", nullable=False)
    creado_en = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Llaves foráneas
    # usuario_id: Estudiante o usuario que reporta la falla o problema
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    
    # asignado_a: Técnico de mantenimiento asignado para resolver el reporte
    asignado_a = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)

    # =========================================================================
    # 🔗 RELACIONES DE SQLALCHEMY (Relationships)
    # =========================================================================
    # Relación bidireccional hacia el creador del reporte
    usuario = relationship(
        "UsuarioModel", 
        back_populates="reportes_creados", 
        foreign_keys=[usuario_id]
    )

    # Relación bidireccional hacia el técnico asignado
    tecnico = relationship(
        "UsuarioModel", 
        back_populates="reportes_asignados", 
        foreign_keys=[asignado_a]
    )

    # Relación bidireccional hacia comentarios con borrado en cascada
    comentarios = relationship(
        "ComentarioModel", 
        back_populates="reporte", 
        cascade="all, delete-orphan"
    )

    # Relación hacia el historial de estados
    historial = relationship(
        "HistorialEstadosModel", 
        back_populates="reporte", 
        cascade="all, delete-orphan"
    )


    def __repr__(self) -> str:
        """
        Método mágico para representar el objeto en logs y depuración interactiva.
        """
        return f"<ReporteModel id={self.id} titulo='{self.titulo}' tipo='{self.tipo_problema}' estado='{self.estado}'>"

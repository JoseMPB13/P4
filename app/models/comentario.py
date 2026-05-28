# app/models/comentario.py
"""
Modelo de datos de Comentarios (SQLAlchemy ORM).
Responsabilidad: Representar la tabla 'comentarios' en la base de datos relacional
para la trazabilidad y bitácora de mantenimiento de los reportes.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.reporte import Base

class ComentarioModel(Base):
    """
    Representación relacional de la tabla 'comentarios'.
    Permite registrar notas, aclaraciones o avances sobre un reporte
    específico realizado por un usuario (estudiante o personal).
    """
    __tablename__ = "comentarios"

    # id: Clave primaria autoincremental
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # reporte_id: Llave foránea hacia la tabla 'reportes' con eliminación en cascada
    reporte_id = Column(Integer, ForeignKey("reportes.id", ondelete="CASCADE"), nullable=False)

    # usuario_id: Llave foránea hacia la tabla 'usuarios' con eliminación en cascada
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)

    # texto: Contenido del comentario
    texto = Column(Text, nullable=False)

    # creado_en: Timestamp de creación con zona horaria
    creado_en = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # =========================================================================
    # 🔗 RELACIONES DE SQLALCHEMY (Relationships)
    # =========================================================================
    # Relación bidireccional hacia ReporteModel
    reporte = relationship("ReporteModel", back_populates="comentarios")

    # Relación bidireccional hacia UsuarioModel
    usuario = relationship("UsuarioModel", back_populates="comentarios")

    def __repr__(self) -> str:
        return f"<ComentarioModel id={self.id} reporte_id={self.reporte_id} usuario_id={self.usuario_id}>"

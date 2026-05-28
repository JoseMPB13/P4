# app/models/historial.py
"""
Modelo de datos del Historial de Estados (SQLAlchemy ORM).
Responsabilidad: Representar la tabla 'historial_estados' para mantener
un registro histórico de auditoría de los cambios de estado de los reportes.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.reporte import Base

class HistorialEstadosModel(Base):
    """
    Representación relacional de la tabla 'historial_estados'.
    Mantiene la trazabilidad de los flujos de resolución de incidentes,
    registrando el estado anterior, el nuevo y el usuario que gatilló el cambio.
    """
    __tablename__ = "historial_estados"

    # id: Clave primaria autoincremental
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # reporte_id: Llave foránea vinculada al reporte, con eliminación en cascada
    reporte_id = Column(Integer, ForeignKey("reportes.id", ondelete="CASCADE"), nullable=False)

    # usuario_id: Identificador del usuario (técnico o administrador) que operó el cambio
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)

    # estado_anterior: Estado del reporte previo al cambio (ej. 'pendiente')
    estado_anterior = Column(String(20), nullable=False)

    # estado_nuevo: Nuevo estado asignado (ej. 'en proceso')
    estado_nuevo = Column(String(20), nullable=False)

    # cambiado_en: Fecha y hora con zona horaria del cambio de estado
    cambiado_en = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # =========================================================================
    # 🔗 RELACIONES DE SQLALCHEMY (Relationships)
    # =========================================================================
    # Relación bidireccional hacia el reporte auditado
    reporte = relationship("ReporteModel", back_populates="historial")

    # Relación simple hacia el usuario autor de la modificación
    usuario = relationship("UsuarioModel")

    def __repr__(self) -> str:
        return f"<HistorialEstadosModel id={self.id} reporte_id={self.reporte_id} estado_nuevo='{self.estado_nuevo}'>"

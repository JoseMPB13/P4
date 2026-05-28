# app/models/usuario.py
"""
Módulo del Modelo de Usuario (SQLAlchemy ORM).
Responsabilidad: Representar la entidad "Usuario" en la base de datos relacional.
Mapea directamente con la tabla "usuarios" en PostgreSQL (Supabase) y hereda
de la clase 'Base' declarativa para registrar las columnas correspondientes.

Este archivo contiene comentarios académicos en español para explicar la
estructura y propiedades físicas de las columnas.
"""

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.models.reporte import Base

class UsuarioModel(Base):
    """
    Representación relacional de la tabla 'usuarios'.
    Contiene la información de identificación, nombre, credenciales
    encriptadas (hashed_password) y rol del usuario para el control de accesos RBAC.
    """
    
    # Nombre exacto de la tabla física en la base de datos relacional
    __tablename__ = "usuarios"

    # id: Clave primaria autoincremental de tipo entero.
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # email: Correo electrónico del usuario.
    email = Column(String(100), unique=True, index=True, nullable=False)

    # hashed_password: Contraseña del usuario almacenada de forma segura.
    hashed_password = Column(String(255), nullable=False)

    # nombre: Nombre completo o apodo del usuario.
    nombre = Column(String(100), nullable=False)

    # rol: Rol asignado para el control de accesos basado en roles (RBAC).
    # Valores permitidos a nivel de Check Constraint: 'estudiante', 'personal_mantenimiento', 'admin'.
    rol = Column(String(30), default="estudiante", nullable=False)

    # =========================================================================
    # 🔗 RELACIONES DE SQLALCHEMY (Relationships)
    # =========================================================================
    # Relación bidireccional hacia ReporteModel (Reportes creados por el estudiante)
    reportes_creados = relationship(
        "ReporteModel", 
        back_populates="usuario", 
        foreign_keys="[ReporteModel.usuario_id]"
    )

    # Relación bidireccional hacia ReporteModel (Reportes asignados al técnico)
    reportes_asignados = relationship(
        "ReporteModel", 
        back_populates="tecnico", 
        foreign_keys="[ReporteModel.asignado_a]"
    )

    # Relación bidireccional hacia ComentarioModel
    comentarios = relationship(
        "ComentarioModel", 
        back_populates="usuario"
    )


    def __repr__(self) -> str:
        """
        Método mágico para depuración. Evita imprimir contraseñas u otros datos
        sensibles en consola o en archivos de logs.
        """
        return f"<UsuarioModel id={self.id} email='{self.email}' nombre='{self.nombre}'>"

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
from app.models.reporte import Base

class UsuarioModel(Base):
    """
    Representación relacional de la tabla 'usuarios'.
    Contiene la información de identificación, nombre y credenciales
    encriptadas (hashed_password) de los usuarios habilitados en el sistema.
    """
    
    # Nombre exacto de la tabla física en la base de datos relacional
    __tablename__ = "usuarios"

    # id: Clave primaria autoincremental de tipo entero.
    # index=True agiliza las búsquedas cuando se referencia por el identificador interno.
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # email: Correo electrónico del usuario.
    # String(100): Límite de 100 caracteres.
    # unique=True: Garantiza a nivel de base de datos que no haya dos usuarios con el mismo correo.
    # index=True: Crea un índice específico para acelerar las consultas de inicio de sesión y autenticación.
    # nullable=False: Campo requerido obligatorio.
    email = Column(String(100), unique=True, index=True, nullable=False)

    # hashed_password: Contraseña del usuario almacenada de forma segura.
    # String(255): Espacio de 255 caracteres para albergar el hash generado por bcrypt.
    # nullable=False: Obligatorio para garantizar la seguridad del acceso.
    hashed_password = Column(String(255), nullable=False)

    # nombre: Nombre completo o apodo del usuario.
    # String(100): Longitud máxima recomendada de 100 caracteres.
    # nullable=False: Campo obligatorio.
    nombre = Column(String(100), nullable=False)

    def __repr__(self) -> str:
        """
        Método mágico para depuración. Evita imprimir contraseñas u otros datos
        sensibles en consola o en archivos de logs.
        """
        return f"<UsuarioModel id={self.id} email='{self.email}' nombre='{self.nombre}'>"

# app/core/config.py
"""
Módulo de Configuración Centralizada.
Responsabilidad: Cargar y validar las variables de entorno definidas en el archivo .env
utilizando pydantic-settings para asegurar la integridad de los datos de configuración
en toda la aplicación.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    """
    Clase que mapea y valida las variables de entorno de la aplicación.
    Si una variable no está en el entorno, tomará el valor por defecto configurado.
    """
    
    # Puerto de ejecución del servidor FastAPI
    PORT: int = Field(default=8000)
    
    # Entorno actual de ejecución (development, production, testing)
    NODE_ENV: str = Field(default="development")
    
    # URL de conexión a la Base de Datos PostgreSQL (para SQLAlchemy)
    DATABASE_URL: str = Field(
        default="postgresql://postgres:PENDIENTE@localhost:5432/infra_db"
    )
    
    # URL de conexión al servidor Redis
    REDIS_URL: str = Field(
        default="redis://default:PENDIENTE@PENDIENTE:6379"
    )

    # Configuración para que Pydantic lea el archivo .env desde la raíz del proyecto
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore" # Ignora variables extra en el archivo .env que no estén declaradas aquí
    )

# Instancia global de configuración para ser importada en el proyecto
settings = Settings()

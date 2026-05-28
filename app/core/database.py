# app/core/database.py
"""
Módulo de Configuración de Base de Datos Relacional (SQLAlchemy).
Responsabilidad: Configurar el motor de base de datos (Engine) y la fábrica de
sesiones transaccionales (SessionLocal), además de exponer la dependencia
de inyección de contexto de base de datos (get_db) para FastAPI.

Este módulo asegura una gestión óptima de los recursos de conexión con PostgreSQL
en Supabase, garantizando la recolección de conexiones y previniendo fugas en el pool.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

from app.core.config import settings

# 1. Inicialización del Motor de Base de Datos (Engine)
# El 'engine' es el punto de partida para cualquier aplicación de SQLAlchemy.
# Administra un pool de conexiones físicas a la base de datos relacional (Supabase/PostgreSQL)
# y traduce las operaciones de Python (ORM) a instrucciones SQL nativas.
engine = create_engine(
    settings.DATABASE_URL,
    # pool_pre_ping=True ayuda a detectar conexiones caídas y a restablecerlas de forma transparente.
    # Es sumamente útil en entornos cloud como Supabase donde las conexiones inactivas pueden ser cerradas.
    pool_pre_ping=True
)

# 2. Fábrica de Sesiones Transaccionales (SessionLocal)
# Cada instancia de 'SessionLocal' actuará como una sesión o transacción activa.
# - autocommit=False: Evita que SQLAlchemy confirme los cambios en la base de datos
#   de manera automática sin una instrucción explícita de 'commit'. Esto preserva
#   la atomicidad de las transacciones complejas.
# - autoflush=False: Evita enviar cambios al servidor de base de datos antes de que se
#   realice una consulta o confirmación explícita, dando mayor control sobre el ciclo de vida.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. Generador de Contexto para Dependencia de Base de Datos (get_db)
# Esta función se expone como una dependencia de FastAPI (Depends).
# Retorna una sesión activa por petición HTTP y asegura su cierre al finalizar el request.
def get_db() -> Generator[Session, None, None]:
    """
    Función generadora que proporciona una sesión transaccional de base de datos (SessionLocal).
    
    ¿Por qué se utiliza el bloque try-finally para el manejo del pool en Supabase?
    ----------------------------------------------------------------------------
    1. Prevención de Fugas de Conexión (Connection Leaks): Supabase es una plataforma
       Serverless/Cloud basada en PostgreSQL y, comúnmente, las conexiones se enrutan
       a través de un Connection Pooler (como Supabase Pooler o PgBouncer). Las conexiones
       concurrentes tienen límites estrictos.
    2. Garantía de Liberación: El uso de 'yield' dentro del bloque 'try' pausa la ejecución
       del generador, entregando la sesión al controlador/endpoint. Una vez que la petición
       concluye (sea exitosamente o debido a un error/excepción no controlada), el flujo
       retoma obligatoriamente en la sección 'finally'.
    3. Cierre Seguro: Al invocar 'db.close()' en 'finally', nos aseguramos de que el socket
       de la conexión se libere y retorne inmediatamente al pool disponible en Supabase,
       evitando que la sesión quede colgada, lo que saturaría el pooler y causaría caídas
       por "Too many connections" (demasiadas conexiones).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

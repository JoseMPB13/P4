# app/redis/client.py
"""
Módulo de Configuración de la Infraestructura de Redis.
Responsabilidad: Instanciar y validar la conexión al servidor de mensajería Redis (Upstash)
utilizando la URL de conexión cargada desde las variables de entorno.

Incluye la prueba de conexión (.ping()) para confirmar la disponibilidad del servicio.
"""

import redis
import logging
from app.core.config import settings

# Configuración de logs
logger = logging.getLogger(__name__)

# Pool de conexiones global para Redis
redis_pool = None

try:
    # 1. Crear el pool de conexiones usando la URL de conexión segura (REDIS_URL de .env)
    # decode_responses=True decodifica automáticamente los bytes recibidos de Redis a strings UTF-8 de Python
    redis_pool = redis.ConnectionPool.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=3.0, # Límite de 3 segundos para evitar bloqueos del hilo principal
        socket_timeout=3.0
    )
    
    # 2. Validar inmediatamente la conexión a Upstash mediante un comando PING
    # Instanciamos un cliente temporal únicamente para realizar el ping de control
    test_client = redis.Redis(connection_pool=redis_pool)
    if test_client.ping():
        logger.info("📡 [REDIS] Conexión establecida y validada con Upstash Redis (PING exitoso).")
    else:
        logger.warning("📡 [REDIS] El servidor Redis respondió de manera anormal al comando PING.")
        
except redis.ConnectionError as err:
    # Error específico de conexión a nivel de red o credenciales incorrectas
    logger.error(
        f"❌ [REDIS ERROR] Falló la conexión inicial con Upstash Redis. "
        f"Verifica la variable REDIS_URL en el archivo .env. Detalles del error: {err}"
    )
except Exception as err:
    # Capturar cualquier otro error inesperado durante la inicialización
    logger.error(f"❌ [REDIS ERROR] Error inesperado al configurar Redis: {err}")

def get_redis_client() -> redis.Redis:
    """
    Retorna una instancia activa del cliente Redis asociada al pool de conexiones global.
    Esta función se inyectará en la lógica del servicio para publicar eventos.
    """
    if redis_pool is None:
        raise ConnectionError("El pool de conexiones de Redis no ha sido inicializado.")
    return redis.Redis(connection_pool=redis_pool)

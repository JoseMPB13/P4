# app/redis/client.py
"""
Cliente de Redis.
Responsabilidad: Establecer y exponer la conexión al servidor de Redis.
Maneja un pool de conexiones de manera que sea eficiente y seguro para
operaciones clave-valor y el patrón de publicación/suscripción (Pub/Sub).
"""

import redis
import logging
from app.core.config import settings

# Configuración básica de logs
logger = logging.getLogger(__name__)

try:
    # Se inicializa el pool de conexiones usando la URL cargada de la configuración
    # decode_responses=True decodifica los bytes recibidos de Redis a strings de Python
    redis_pool = redis.ConnectionPool.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_connect_timeout=2.0 # Evitar bloqueos indefinidos si Redis no responde
    )
    logger.info("Pool de conexiones de Redis configurado exitosamente.")
except Exception as e:
    logger.error(f"Error al configurar el pool de conexiones de Redis: {e}")
    redis_pool = None

def get_redis_client() -> redis.Redis:
    """
    Obtiene y retorna una instancia del cliente de Redis.
    Puede usarse como dependencia o invocarse directamente.
    """
    if redis_pool is None:
        raise ConnectionError("El pool de conexiones de Redis no fue inicializado correctamente.")
    return redis.Redis(connection_pool=redis_pool)

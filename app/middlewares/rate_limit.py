# app/middlewares/rate_limit.py
"""
Middleware de Control de Frecuencia Distribuido (Rate Limiting).
Responsabilidad: Monitorear y limitar la frecuencia de solicitudes entrantes
desde una misma dirección IP para prevenir abusos de la API.

Esta versión sustituye el almacenamiento temporal en memoria local por Redis,
resolviendo problemas de concurrencia y fugas de memoria en múltiples workers de producción.

Reglas del negocio académica:
- Ventana de tiempo: 15 minutos (900 segundos).
- Límite de peticiones: 100 solicitudes por IP dentro de la ventana.
- Aplica únicamente a rutas que inician con '/api/'.
"""

import logging
from datetime import datetime, timezone
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.redis.client import get_redis_client

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware personalizado para aplicar Rate Limiting basado en la IP del cliente y almacenado en Redis.
    Hereda de BaseHTTPMiddleware de Starlette para interceptar el ciclo de solicitud-respuesta.
    """
    
    def __init__(self, app):
        super().__init__(app)
        
        # 15 minutos de ventana expresados en segundos (900 segundos)
        self._ventana_tiempo: int = 15 * 60
        
        # Límite máximo de solicitudes permitidas
        self._limite_solicitudes: int = 100

    async def dispatch(self, request: Request, call_next):
        """
        Intercepta la petición entrante, evalúa si excede el límite de velocidad utilizando Redis
        e interrumpe o continúa el flujo según corresponda.
        
        ¿Por qué migrar a Redis en lugar de diccionarios en memoria local?
        -----------------------------------------------------------------
        1. Thread-Safety / Concurrencia Distribuida: En entornos de producción con múltiples workers 
           (ej. uvicorn con multi-procesos o balanceadores de carga), la memoria local no se comparte.
           Redis centraliza el estado de forma atómica.
        2. Operaciones Atómicas (INCR): Incrementar un contador mediante INCR de Redis es una operación
           atómica. Garantiza que la lectura y modificación no tengan condiciones de carrera.
        3. Expiración Nativa (TTL): Redis elimina automáticamente las llaves obsoletas tras concluir
           su ciclo de expiración, resolviendo de raíz las fugas de memoria (Memory Leaks).
        4. Resiliencia (Fail-Open): Si la conexión a Redis falla, el middleware captura el error y 
           permite el paso de la petición para priorizar la disponibilidad de la plataforma.
        """
        ruta = request.url.path

        # Aplicar el filtro únicamente a las rutas bajo el prefijo '/api/'
        if ruta.startswith("/api/"):
            # Obtener la dirección IP del cliente. Si no se puede resolver, se asigna "desconocido"
            ip_cliente = request.client.host if request.client else "desconocido"
            
            # Generar clave dinámica única por cliente IP
            clave = f"rate:limiter:{ip_cliente}"

            try:
                # Obtener el cliente global de Redis
                redis_client = get_redis_client()
                
                # Incrementar atómicamente el contador del cliente IP
                contador = redis_client.incr(clave)
                
                # Si es la primera solicitud dentro del ciclo, establecer el tiempo de expiración (900 segundos)
                if contador == 1:
                    redis_client.expire(clave, self._ventana_tiempo)
                
                # Si el contador excede el límite configurado (100 peticiones)
                if contador > self._limite_solicitudes:
                    logger.warning(f"Rate Limiter: Cliente {ip_cliente} excedió el límite con {contador} peticiones.")
                    
                    # Retorna de inmediato un HTTP 429 (Too Many Requests) sin procesar la ruta
                    return JSONResponse(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        content={
                            "error": "Límite de peticiones excedido. Intente de nuevo en 15 minutos.",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "ruta": ruta
                        }
                    )
            except Exception as err:
                # Enfoque Resiliente Fail-Open: Si Redis falla, registramos el error en logs y permitimos
                # el paso de la petición para evitar la caída total del servicio por un problema de infraestructura.
                logger.error(f"Rate Limiter: Error al comunicarse con Redis para limitar tasa: {err}")

        # Continuar la petición enviándola al siguiente middleware o ruta de la API
        response = await call_next(request)
        return response

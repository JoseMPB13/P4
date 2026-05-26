# app/middlewares/rate_limit.py
"""
Middleware de Control de Frecuencia (Rate Limiting).
Responsabilidad: Monitorear y limitar la frecuencia de solicitudes entrantes
desde una misma dirección IP para prevenir ataques de denegación de servicio (DoS)
y abuso de la API de reportes.

Reglas del negocio académica:
- Ventana de tiempo: 15 minutos (900 segundos).
- Límite de peticiones: 100 solicitudes por IP dentro de la ventana.
- Aplica únicamente a rutas que inician con '/api/'.
"""

import time
from datetime import datetime
from typing import Dict, List
from fastapi import Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware personalizado para aplicar Rate Limiting basado en la IP del cliente.
    Hereda de BaseHTTPMiddleware de Starlette para interceptar el ciclo de solicitud-respuesta.
    """
    
    def __init__(self, app):
        super().__init__(app)
        
        # Diccionario en memoria para almacenar las marcas de tiempo (timestamps) de las peticiones.
        # Llave: IP del cliente (string), Valor: Lista de timestamps (floats).
        # Nota: Almacenar esto en memoria limpia es adecuado para entornos académicos,
        # pero en producción se recomienda usar Redis para persistencia y escalabilidad distribuida.
        self._historial_peticiones: Dict[str, List[float]] = {}
        
        # 15 minutos en segundos
        self._ventana_tiempo: float = 15.0 * 60.0
        
        # Límite máximo de solicitudes permitidas
        self._limite_solicitudes: int = 100

    async def dispatch(self, request: Request, call_next):
        """
        Intercepta la petición entrante, evalúa si excede el límite de velocidad
        e interrumpe o continúa el flujo según corresponda.
        """
        ruta = request.url.path

        # Aplicar el filtro únicamente a las rutas bajo el prefijo '/api/'
        # Esto permite que la documentación de Swagger (/docs, /redoc) no se bloquee por rate limiting
        if ruta.startswith("/api/"):
            # Obtener la dirección IP del cliente. Si no se puede resolver, se asigna "desconocido"
            ip_cliente = request.client.host if request.client else "desconocido"
            tiempo_actual = time.time()

            # Obtener el historial de la IP o inicializarlo si es su primera petición
            historial = self._historial_peticiones.setdefault(ip_cliente, [])

            # Filtrar y remover del historial los registros más antiguos que la ventana de 15 minutos.
            # Esto es un mecanismo de ventana deslizante simple.
            historial = [t for t in historial if tiempo_actual - t < self._ventana_tiempo]
            
            # Actualizar el diccionario con el historial depurado
            self._historial_peticiones[ip_cliente] = historial

            # Verificar si el cliente ha superado el número máximo de peticiones permitidas
            if len(historial) >= self._limite_solicitudes:
                # Retorna un error HTTP 429 Too Many Requests en formato JSON unificado
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "Demasiadas peticiones desde esta IP.",
                        "timestamp": datetime.utcnow().isoformat(),
                        "ruta": ruta
                    }
                )

            # Si no ha excedido el límite, registramos el timestamp actual y permitimos el paso
            historial.append(tiempo_actual)

        # Cierra el interceptor enviando la petición al siguiente middleware o ruta de la API
        response = await call_next(request)
        return response

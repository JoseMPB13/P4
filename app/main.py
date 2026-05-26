# app/main.py
"""
Punto de Entrada Principal de FastAPI.
Responsabilidad: Instanciar la aplicación FastAPI, incluir el enrutador de reportes
bajo el prefijo de API global (/api) y registrar los manejadores de excepciones
globales (Exception Handlers) para formatear respuestas de error uniformes.

Contiene comentarios detallados en español sobre el flujo de control
y la asignación de códigos de estado HTTP para los errores.
"""

import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import logging

from app.core.config import settings
from app.api.endpoints.reportes import router as reportes_router
from app.redis.client import get_redis_client

# Configuración del registrador de logs
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Instancia de la aplicación FastAPI
app = FastAPI(
    title="Plataforma de Reportes de Infraestructura Universitaria",
    description="Backend FastAPI con arquitectura limpia y manejo de errores consistente.",
    version="1.1.0"
)

# Configuración de CORS para permitir solicitudes del navegador (Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================================================================
# 🛡️ MANEJADORES GLOBALES DE EXCEPCIONES (Materia/Requisito Académico)
# =========================================================================

# 1. Manejador para excepciones de tipo HTTPException (FastAPI o lanzadas por el desarrollador)
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """
    Captura cualquier error HTTP (ej: 404 de recurso no encontrado, 403 prohibido).
    Retorna una estructura JSON consistente para el cliente.
    """
    logger.warning(f"HTTPException capturada: {exc.status_code} - {exc.detail} en {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "timestamp": datetime.utcnow().isoformat(),
            "ruta": request.url.path
        }
    )

# 2. Manejador para errores de validación de esquemas (Pydantic / RequestValidationError)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Captura los errores de validación de datos (cuando el JSON enviado no cumple con el esquema Pydantic).
    Transforma los detalles internos de Pydantic a un string comprensible y unificado.
    
    ¿Por qué Código 422 Unprocessable Entity?: Es el estándar en APIs HTTP para indicar
    que la sintaxis de la petición es correcta, pero contiene datos semánticamente incorrectos
    o faltantes que el servidor no puede procesar.
    """
    logger.warning(f"Error de validación capturado en {request.url.path}: {exc.errors()}")
    
    # Formatear la lista de errores para generar un mensaje amigable
    mensajes_errores = []
    for error in exc.errors():
        # loc indica la ubicación del campo erróneo, ej: ('body', 'titulo')
        campo = " -> ".join(str(x) for x in error.get("loc", [])[1:])
        detalles = error.get("msg", "valor inválido")
        mensajes_errores.append(f"[{campo}]: {detalles}")
        
    error_unificado = "; ".join(mensajes_errores) if mensajes_errores else "Error de validación en los datos de entrada."

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, # Código estándar 422
        content={
            "error": f"Error de validación: {error_unificado}",
            "timestamp": datetime.utcnow().isoformat(),
            "ruta": request.url.path
        }
    )

# 3. Manejador genérico para cualquier otro error inesperado (Exception de Python)
@app.exception_handler(Exception)
async def global_unexpected_exception_handler(request: Request, exc: Exception):
    """
    Manejador global para atrapar cualquier error no controlado por el código (ej: fallos de lógica de Python,
    errores de punteros o bases de datos caídas sin control). Previene que la API colapse y exponga el traceback.
    
    ¿Por qué Código 500 Internal Server Error?: Es el estándar para indicar que el servidor
    encontró una condición inesperada que le impidió completar la solicitud del cliente.
    """
    logger.error(f"Error inesperado no controlado: {str(exc)} en {request.url.path}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, # Código estándar 500
        content={
            "error": f"Error interno en el servidor: {str(exc)}",
            "timestamp": datetime.utcnow().isoformat(),
            "ruta": request.url.path
        }
    )

# =========================================================================
# Enrutamiento de la API
# =========================================================================

# Registramos el router de reportes bajo el prefijo '/api'
# Dado que el router de reportes tiene prefix='/reportes', los endpoints
# quedarán expuestos bajo la ruta base de la API: '/api/reportes'
app.include_router(reportes_router, prefix="/api")


@app.get(
    "/",
    tags=["General"],
    summary="Raíz de la API"
)
def raiz():
    return {
        "plataforma": "Reportes de Infraestructura Universitaria",
        "docs": "/docs",
        "endpoints_base": "/api/reportes"
    }


@app.get(
    "/health",
    tags=["General"],
    summary="Estado de Salud (Healthcheck)"
)
def verificar_salud():
    estado_redis = "inactivo"
    try:
        client = get_redis_client()
        if client.ping():
            estado_redis = "activo"
    except Exception:
        pass

    return {
        "estado_api": "saludable",
        "persistencia": "en_memoria (modo académico)",
        "redis": estado_redis
    }


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)

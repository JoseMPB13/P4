# app/main.py
"""
Punto de Entrada Principal de la Aplicación FastAPI.
Responsabilidad: Configurar e inicializar la aplicación FastAPI, 
registrar middlewares, rutas (routers) globales y manejar eventos de inicio/cierre.
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from app.core.config import settings
from app.api.endpoints.reportes import router as reportes_router
from app.redis.client import get_redis_client

# Configuración del sistema de logging para depuración académica y producción
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Creación de la instancia global de FastAPI
app = FastAPI(
    title="Plataforma de Reportes de Infraestructura Universitaria",
    description=(
        "API Backend modular construida con FastAPI y Arquitectura Limpia. "
        "Permite el registro, seguimiento y gestión de incidencias de infraestructura "
        "dentro del campus universitario."
    ),
    version="1.0.0",
    docs_url="/docs",       # Ruta para documentación Swagger UI
    redoc_url="/redoc"      # Ruta para documentación ReDoc
)

# Configuración de CORS (Cross-Origin Resource Sharing)
# Útil si el frontend de la plataforma se despliega en un origen distinto
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permitir todos los orígenes en desarrollo académico
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registro del Router de Reportes con su prefijo y etiqueta correspondiente
app.include_router(reportes_router, prefix="/api/v1/reportes", tags=["Reportes de Infraestructura"])

@app.get(
    "/",
    tags=["General"],
    summary="Raíz de la API",
    description="Endpoint básico para validar que la API está en línea y funcionando."
)
def raiz():
    return {
        "plataforma": "Reportes de Infraestructura Universitaria",
        "estado": "activo",
        "entorno": settings.NODE_ENV,
        "docs": "/docs"
    }

@app.get(
    "/health",
    tags=["General"],
    summary="Estado de Salud (Healthcheck)",
    description="Verifica el estado del servicio de API y la conexión con el servidor Redis."
)
def verificar_salud():
    estado_redis = "inactivo/desconectado"
    try:
        # Intenta verificar la conectividad de Redis enviando un comando PING
        client = get_redis_client()
        if client.ping():
            estado_redis = "activo"
    except Exception as err:
        logger.warning(f"La verificación de Redis falló: {err}")

    return {
        "estado_api": "saludable",
        "almacenamiento_temporal": "en_memoria (modo académico activo)",
        "estado_redis": estado_redis
    }

# Evento que se ejecuta al iniciar el servidor
@app.on_event("startup")
def al_iniciar():
    logger.info("=========================================================")
    logger.info(f"Iniciando Plataforma de Reportes de Infraestructura")
    logger.info(f"Entorno: {settings.NODE_ENV}")
    logger.info(f"Puerto Configurado: {settings.PORT}")
    logger.info("=========================================================")

# Ejecutar con uvicorn si se corre el archivo directamente
if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.PORT, reload=True)

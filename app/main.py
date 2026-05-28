# app/main.py
"""
Punto de Entrada Principal de FastAPI.
Responsabilidad: Configurar el framework de FastAPI, registrar middlewares
en el orden correcto de ejecución (CORS y Rate Limiting), definir los manejadores
de excepciones globales y personalizar el esquema de OpenAPI para soportar Bearer JWT.

Explicación del Flujo de Peticiones y Middlewares:
- En FastAPI/Starlette, los middlewares se envuelven en una pila (LIFO). El último middleware
  agregado con `app.add_middleware` es el más externo y el primero en procesar la petición.
- Por esta razón, añadimos primero `RateLimitMiddleware` y de último `CORSMiddleware`.
- Flujo resultante de la petición:
  Petición Entrante -> [CORS Middleware] -> [Rate Limit Middleware] -> [Manejador de Rutas API]
- ¿Por qué CORS debe ejecutarse antes?:
  1. Preflight Requests (OPTIONS): Las peticiones CORS OPTIONS no deben consumir el cupo de peticiones
     del limitador de frecuencia. CORSMiddleware intercepta y responde a estas solicitudes directamente.
  2. Respuestas de Bloqueo (429): Si el Rate Limiter bloquea a un usuario y CORS se ejecutara después,
     la respuesta 429 carecería de las cabeceras CORS necesarias, causando que el navegador del cliente
     bloquee la lectura del error debido a políticas de origen cruzado (CORS error).
"""

import uvicorn
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from datetime import datetime, timezone
import logging

from app.core.config import settings
from app.api.endpoints.reportes import router as reportes_router
from app.api.endpoints.auth import router as auth_router
from app.redis.client import get_redis_client
# Importación del middleware personalizado de control de frecuencia
from app.middlewares.rate_limit import RateLimitMiddleware

# Configuración del log
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

# Instancia de FastAPI con metadatos personalizados para OpenAPI
app = FastAPI(
    title="Plataforma de Reportes de Infraestructura Universitaria API",
    description=(
        "Backend para la administración de incidencias de infraestructura universitaria. "
        "Permite el registro, priorización, control de estados de reportes y difusión de eventos mediante Redis."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)


# =========================================================================
# 🛡️ INYECCIÓN DE CABECERAS DE SEGURIDAD (HTTP Security Headers)
# =========================================================================

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """
    Middleware HTTP nativo asíncrono que inyecta cabeceras web de seguridad (equivalente a Helmet)
    en cada una de las respuestas HTTP salientes de la API.

    Explicación académica de cada cabecera inyectada:
    --------------------------------------------------
    1. X-Frame-Options (DENY): Evita que la plataforma sea embebida en <iframe>. Esto mitiga 
       los ataques de 'Clickjacking', donde un atacante superpone un marco invisible para engañar al usuario.
    2. X-Content-Type-Options (nosniff): Evita la autodetección (sniffing) de tipos MIME por parte
       del navegador, forzándolo a seguir el tipo declarado en Content-Type. Evita inyecciones de código.
    3. X-XSS-Protection (1; mode=block): Activa de forma estricta los filtros incorporados contra XSS
       en navegadores heredados, bloqueando la carga si se identifica código malicioso.
    4. Content-Security-Policy (CSP): Define un origen de confianza exclusivo para la carga y ejecución
       de scripts y estilos, mitigando ataques de Cross-Site Scripting (XSS) y Clickjacking.
    5. Strict-Transport-Security (HSTS): Fuerza el uso de conexiones HTTPS durante 1 año (31536000 s),
       previniendo ataques Man-in-the-Middle y degradación de seguridad (SSL Stripping).
    """
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    )
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# =========================================================================
# 🛡️ REGISTRO DE MIDDLEWARES (Orden Inverso de Declaración)
# =========================================================================


# 1. Agregamos el Rate Limiting (más interno que CORS)
app.add_middleware(RateLimitMiddleware)

# 2. Agregamos CORS (más externo, se ejecuta primero)
# Configurado para permitir orígenes de desarrollo típicos en React/Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Puerto por defecto de Vite
        "http://localhost:3000"   # Puerto común en React/Next.js
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# =========================================================================
# 🛡️ MANEJADORES GLOBALES DE EXCEPCIONES
# =========================================================================

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    logger.warning(f"HTTPException capturada: {exc.status_code} - {exc.detail} en {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ruta": request.url.path
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Error de validación capturado en {request.url.path}: {exc.errors()}")
    mensajes_errores = []
    for error in exc.errors():
        campo = " -> ".join(str(x) for x in error.get("loc", [])[1:])
        detalles = error.get("msg", "valor inválido")
        mensajes_errores.append(f"[{campo}]: {detalles}")
        
    error_unificado = "; ".join(mensajes_errores) if mensajes_errores else "Error de validación en los datos."

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": f"Error de validación: {error_unificado}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ruta": request.url.path
        }
    )

@app.exception_handler(Exception)
async def global_unexpected_exception_handler(request: Request, exc: Exception):
    logger.error(f"Error no controlado: {str(exc)} en {request.url.path}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": f"Error interno en el servidor: {str(exc)}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ruta": request.url.path
        }
    )

# =========================================================================
# 📝 PERSONALIZACIÓN DE OPENAPI (JWT Bearer Auth en Swagger)
# =========================================================================

def custom_openapi():
    """
    Función para sobrescribir el esquema OpenAPI autogenerado de FastAPI.
    Inyecta de forma segura el esquema BearerAuth en la sección components
    para habilitar el botón "Authorize" en Swagger UI.
    """
    if app.openapi_schema:
        return app.openapi_schema
        
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    
    # Asegurar que la estructura components exista en el JSON
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}
        
    # Inyectar la configuración de seguridad Bearer JWT
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Ingresa el token JWT en el formato: Bearer <TOKEN>"
        }
    }
    
    # Asignar la seguridad de forma opcional (puede aplicarse individualmente en los endpoints)
    app.openapi_schema = openapi_schema
    return app.openapi_schema

# Sobrescribir el método openapi nativo con nuestra función personalizada
app.openapi = custom_openapi

# =========================================================================
# Enrutamiento de la API
# =========================================================================

app.include_router(reportes_router, prefix="/api")
app.include_router(auth_router, prefix="/api")

@app.get("/", tags=["General"], summary="Raíz de la API")
def raiz():
    return {
        "plataforma": "Reportes de Infraestructura Universitaria",
        "docs": "/docs",
        "endpoints_base": "/api/reportes"
    }

@app.get("/health", tags=["General"], summary="Estado de Salud (Healthcheck)")
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
        "persistencia": "PostgreSQL (SQLAlchemy)",
        "redis": estado_redis
    }

if __name__ == "__main__":
    import os
    # Conversión segura del puerto a partir de variables de entorno para despliegues como Render
    puerto = int(os.getenv("PORT", settings.PORT))
    # En producción deshabilitamos el reload automático para mejorar el rendimiento
    es_produccion = os.getenv("NODE_ENV", settings.NODE_ENV) == "production"
    
    logger.info(f"Iniciando servidor en el puerto: {puerto} (Producción: {es_produccion})")
    uvicorn.run("app.main:app", host="0.0.0.0", port=puerto, reload=not es_produccion)


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
from fastapi import FastAPI, Request, status, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from datetime import datetime, timezone
import logging
# Comentario en español: Importamos threading y asyncio para correr la escucha de Redis Pub/Sub en segundo plano
import threading
import asyncio
import json
import time
import redis

from app.core.config import settings
from app.api.endpoints.reportes import router as reportes_router
from app.api.endpoints.auth import router as auth_router
from app.api.endpoints.usuarios import router as usuarios_router
from app.redis.client import get_redis_client
# Importación del middleware personalizado de control de frecuencia
from app.middlewares.rate_limit import RateLimitMiddleware

# Configuración del log
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Issue Realtime",
    description=(
        "Backend para la administración de problemas o fallas de infraestructura universitaria. "
        "Permite el registro, priorización, control de estados de reportes y difusión de eventos mediante Redis."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# =========================================================================
# 📡 GESTOR DE CONEXIONES WEBSOCKET (Equivalente a Socket.io)
# =========================================================================

class ConnectionManager:
    """
    Administrador de conexiones WebSocket para retransmitir eventos en tiempo real
    a los clientes web conectados.
    """
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket: Cliente conectado. Total conexiones activas: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket: Cliente desconectado. Total conexiones activas: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        """
        Retransmite un mensaje de texto a todos los WebSockets conectados.
        """
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as err:
                logger.error(f"WebSocket: Error al enviar mensaje a un cliente: {err}")

manager = ConnectionManager()

def redis_pubsub_listener():
    """
    Función del hilo de fondo que se suscribe a los eventos 'study:*' de Redis Pub/Sub
    y llama al broadcast de WebSockets de manera segura sobre el bucle de eventos.
    
    Implementación Resiliente con Reconexión y Retraso Exponencial (Exponential Backoff):
    - Envuelto dentro de un bucle de control infinito 'while True' para asegurar que el hilo
      nunca muera de forma silenciosa si la conexión con Upstash falla.
    - Captura excepciones de red específicas de Redis (ConnectionError, TimeoutError).
    - Implementa retrasos que inician en 1 segundo y se duplican en cada intento fallido,
      hasta alcanzar un tope máximo de 60 segundos.
    - Al reestablecer exitosamente la suscripción y recibir mensajes, se reinicia el retraso.
    """
    logger.info("📡 [Redis Listener Thread] Iniciando escucha en el patrón 'campus:*'...")
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    backoff = 1  # Tiempo de retraso inicial para reconexión exponencial

    while True:
        try:
            logger.info("📡 [Redis Listener Thread] Conectando a Redis Pub/Sub...")
            redis_client = get_redis_client()
            
            # Verificación del estado del canal/cliente mediante ping
            redis_client.ping()
            
            pubsub_obj = redis_client.pubsub()
            pubsub_obj.psubscribe("campus:*")
            logger.info("📡 [Redis Listener Thread] Suscripción exitosa a 'campus:*' en Redis Pub/Sub.")
            
            # Conexión exitosa establecida: reestablecemos el backoff al valor inicial
            backoff = 1
            
            # Escuchamos bloqueando el hilo de fondo
            for mensaje in pubsub_obj.listen():
                if mensaje["type"] == "pmessage":
                    data_str = mensaje["data"]
                    if isinstance(data_str, bytes):
                        data_str = data_str.decode("utf-8")
                    
                    logger.info(f"📡 [Redis Listener Thread] Mensaje recibido de Redis Pub/Sub: {data_str}")
                    # Hacemos broadcast llamando de manera segura al loop de eventos principal de la aplicación
                    asyncio.run_coroutine_threadsafe(manager.broadcast(data_str), main_loop)
                    
        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as redis_err:
            logger.error(
                f"📡 [Redis Listener Thread] Fallo de red/timeout con Redis Pub/Sub: {redis_err}. "
                f"Reintentando reconexión en {backoff} segundos..."
            )
            time.sleep(backoff)
            # Incremento exponencial con tope máximo de 60 segundos para evitar reintentos infinitos sin control
            backoff = min(backoff * 2, 60)
            
        except Exception as err:
            logger.error(
                f"📡 [Redis Listener Thread] Error inesperado en el canal de comunicación: {err}. "
                f"Reintentando en {backoff} segundos..."
            )
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)

# Bucle de eventos principal que guardaremos al arrancar
main_loop = None

@app.on_event("startup")
def startup_event():
    """
    Evento de inicio de FastAPI. Captura el event loop principal e inicia el hilo
    de fondo para la escucha asíncrona de Redis Pub/Sub.
    """
    global main_loop
    main_loop = asyncio.get_event_loop()
    
    thread = threading.Thread(target=redis_pubsub_listener, daemon=True)
    thread.start()
    logger.info("📡 [Startup] Hilo secundario para Redis Pub/Sub iniciado exitosamente.")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Ruta de WebSocket para recibir conexiones en tiempo real.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Espera mensajes del cliente (para pings o mantener activa la conexión)
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as err:
        logger.error(f"WebSocket: Error inesperado en conexión: {err}")
        manager.disconnect(websocket)



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
    # Comentario en español: Cambiado de DENY a SAMEORIGIN según el checklist para permitir uso de marcos internos del mismo dominio
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; "
        "img-src 'self' data: https://fastapi.tiangolo.com https://sglshnnttwgjlsgkhrto.supabase.co https://*.supabase.co; "
        "worker-src 'self' blob:; "
        "connect-src 'self' ws: wss: https://*.supabase.co https://sglshnnttwgjlsgkhrto.supabase.co;"
    )
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# =========================================================================
# 🛡️ REGISTRO DE MIDDLEWARES (Orden Inverso de Declaración)
# =========================================================================


# 1. Agregamos el Rate Limiting (más interno que CORS)
app.add_middleware(RateLimitMiddleware)

# 2. Agregamos CORS (más externo, se ejecuta primero en la pila de middlewares)
# Comentario en español:
# Configuración de CORSMiddleware en FastAPI para permitir la comunicación bidireccional y el consumo de 
# la API desde el frontend de desarrollo local (incluyendo Live Server y frameworks como Vite o React).
# - allow_origins: Lista de orígenes de confianza permitidos que pueden consumir los recursos del backend.
# - allow_credentials: Habilitado en True para permitir el envío de cookies, tokens de sesión y cabeceras
#   de autorización tipo Bearer en peticiones cruzadas.
# - allow_methods: Permitimos todos los verbos HTTP ("*") como GET, POST, PUT, DELETE, y OPTIONS para CORS preflight.
# - allow_headers: Permitimos todas las cabeceras HTTP ("*") enviadas por el navegador del cliente (como Authorization, Content-Type, etc).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Puerto por defecto de Vite
        "http://localhost:3000",  # Puerto común de React/Next.js
        "http://127.0.0.1:5500",  # Puerto por defecto de Live Server (IP local)
        "http://localhost:5500"   # Puerto por defecto de Live Server (localhost)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.exception_handler(json.JSONDecodeError)
async def json_decode_exception_handler(request: Request, exc: json.JSONDecodeError):
    # Comentario en español: Capturamos fallos en decodificación de JSON (ej: cuerpo de petición vacío o inválido)
    # y respondemos con un HTTP 400 Bad Request semántico controlado, previniendo caídas imprevistas (BUG-001).
    logger.warning(f"Error de decodificación JSON en {request.url.path}: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": "El cuerpo de la petición no es un JSON válido o está vacío.",
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
    Inyecta de forma segura el esquema OAuth2PasswordBearer en la sección components
    para habilitar el botón "Authorize" en Swagger UI y vincular la autenticación
    al endpoint de inicio de sesión (/api/auth/login).
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
        
    # Inyectar la configuración de seguridad Bearer JWT directa en lugar del flujo de contraseña OAuth2
    openapi_schema["components"]["securitySchemes"] = {
        "OAuth2PasswordBearer": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT",
            "description": "Ingresa el token JWT directamente para autorizar las solicitudes."
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

# Sobrescribir el método openapi nativo con nuestra función personalizada
app.openapi = custom_openapi

# =========================================================================
# Enrutamiento de la API
# =========================================================================

app.include_router(reportes_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(usuarios_router, prefix="/api")

# Comentado para permitir que la raíz "/" sirva el frontend estático (index.html)
# @app.get("/", tags=["General"], summary="Raíz de la API")
# def raiz():
#     return {
#         "plataforma": "Reportes de Infraestructura Universitaria",
#         "docs": "/docs",
#         "endpoints_base": "/api/reportes"
#     }

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

# Montar los archivos estáticos en la raíz (estrictamente después de los endpoints de la API)
app.mount("/", StaticFiles(directory="frontend", html=True), name="static")

if __name__ == "__main__":
    import os
    # Conversión segura del puerto a partir de variables de entorno para despliegues como Render
    puerto = int(os.getenv("PORT", settings.PORT))
    # En producción deshabilitamos el reload automático para mejorar el rendimiento
    es_produccion = os.getenv("NODE_ENV", settings.NODE_ENV) == "production"
    
    logger.info(f"Iniciando servidor en el puerto: {puerto} (Producción: {es_produccion})")
    uvicorn.run("app.main:app", host="0.0.0.0", port=puerto, reload=not es_produccion)


# Bitácora de Control de Calidad: Historial de Bugs Críticos (BUGS.md)

Este documento detalla el análisis de control de calidad y la auditoría técnica de los fallos críticos resueltos durante las fases de refactorización y pre-despliegue del "Sistema de Reportes de Incidencias de Infraestructura Universitaria". Cada reporte de error sigue los estándares de Aseguramiento de la Calidad (QA) utilizando el formato solicitado: **SÍNTOMA**, **CAUSA RAÍZ** y **SOLUCIÓN APLICADA**.

---

## BUG-001: Fuga de Conexiones en Supabase PostgreSQL por cierre ausente de sesiones de SQLAlchemy

### SÍNTOMA
El servidor backend comenzaba a fallar de manera intermitente respondiendo con errores `500 Internal Server Error` en peticiones de consulta y creación de reportes. En los logs de la base de datos de Supabase PostgreSQL se registraba el error `FATAL: remaining connection slots are reserved for non-replication bootstrap connection` o `too many clients already`, bloqueando nuevas conexiones a la base de datos.

### CAUSA RAÍZ
En el generador de sesiones de base de datos (`get_db()`) utilizado como dependencia en FastAPI, no se garantizaba de forma determinista el cierre de la sesión transaccional de SQLAlchemy en caso de excepciones o respuestas rápidas. Al no cerrarse la sesión, la conexión física se mantenía abierta en el pool del Pooler de Supabase (puerto 6543) o directamente en el puerto directo (5432) hasta expirar por inactividad, provocando un agotamiento total de las conexiones disponibles.

### SOLUCIÓN APLICADA
Se reestructuró la función generadora `get_db()` en `app/core/database.py` envolviendo la creación y el rendimiento (`yield`) de la sesión dentro de un bloque `try-finally` estructurado:

```python
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```
El uso del bloque `finally` asegura que la sesión de SQLAlchemy invoque `.close()` de forma obligatoria, liberando y retornando la conexión al pool sin importar si la petición HTTP culminó con éxito o generó un error interno durante la ruta.

---

## BUG-002: Caída del Servidor / Pérdida de Tiempo Real al desconectarse Upstash Redis por desuso de sockets TCP

### SÍNTOMA
El feed interactivo de notificaciones y la transmisión de eventos en tiempo real mediante WebSockets dejaban de funcionar silenciosamente pasados unos minutos de inactividad de los usuarios. Aunque la API de FastAPI seguía respondiendo a peticiones HTTP normales, el hilo de fondo encargado de escuchar a Redis Pub/Sub moría, y era necesario reiniciar por completo el servidor backend para reactivar el tiempo real.

### CAUSA RAÍZ
El proveedor Upstash Redis implementa políticas agresivas de desconexión por inactividad (timeouts) sobre sockets TCP inactivos para optimizar sus recursos en planes Serverless. Cuando no había actividad de publicación en el canal de suscripción, el socket se cerraba, provocando que `pubsub_obj.listen()` arrojara un error de tipo `redis.exceptions.ConnectionError` o `TimeoutError`, lo cual terminaba abruptamente la ejecución del hilo secundario de escucha ya que este carecía de capturadores y de un flujo de reintentos resiliente.

### SOLUCIÓN APLICADA
Se refactorizó la función `redis_pubsub_listener()` en `app/main.py` de la siguiente manera:
1. Se envolvió todo el flujo de conexión y escucha dentro de un bucle de control infinito `while True`.
2. Se introdujo una captura segura y explícita para excepciones de red de Redis:
   ```python
   except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as redis_err:
   ```
3. Se implementó un algoritmo de reconexión con retraso exponencial (Exponential Backoff) que inicia en 1 segundo, durmiendo el hilo con `time.sleep(backoff)` en cada intento fallido y duplicándose progresivamente (`backoff = min(backoff * 2, 60)`) hasta un tope seguro de 60 segundos. Al reconectarse y validar el socket mediante `redis_client.ping()`, el retraso de reintento se restablece de forma reactiva a 1 segundo.

---

## BUG-003: Excepción de Seguridad en WebSockets por protocolo incorrecto en producción

### SÍNTOMA
Al desplegar la aplicación en el entorno de producción en la nube (ej. Render), la consola del navegador del cliente arrojaba excepciones de seguridad de tipo `SecurityError: Failed to construct 'WebSocket'` y bloqueaba la conexión al servicio en tiempo real. Como resultado, la interfaz del portal web no mostraba notificaciones.

### CAUSA RAÍZ
En producción, el portal web se sirve obligatoriamente bajo protocolo seguro HTTPS. Los navegadores web modernos aplican políticas de protección de contenido mixto (*Mixed Content*), bloqueando cualquier intento de iniciar conexiones WebSocket sin cifrar (`ws://`) desde páginas seguras HTTPS. En el código del frontend, la URL del WebSocket estaba prefijada o forzada con `ws://`, lo que disparaba el bloqueo automático por políticas del navegador.

### SOLUCIÓN APLICADA
Se refactorizó el servicio de cliente de WebSockets (`frontend/js/services/websocket.js`) para resolver la URL de forma totalmente dinámica y adaptativa en base al protocolo de la API actual (`API_URL`), asegurando que si la API corre en HTTPS, el socket se instancie automáticamente con `wss://` (WebSocket Secure):

```javascript
const wsBaseUrl = API_URL
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:")
    .replace(/\/api$/, "/ws");
```
Esto garantiza la compatibilidad en local (`http://127.0.0.1` -> `ws://127.0.0.1`) y la seguridad requerida en entornos de producción con TLS/SSL (`https://render.com` -> `wss://render.com`), superando las restricciones de contenido mixto del navegador.

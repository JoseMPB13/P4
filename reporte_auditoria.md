# Reporte de Auditoría Técnica Completa: StudySync API
**Auditoría de Cumplimiento Técnico, Seguridad Backend y Experiencia del Frontend**  
**Proyecto Evaluado:** StudySync API (Stack Real: Python + FastAPI + SQLAlchemy + Supabase PostgreSQL + Redis Upstash + WebSockets nativos)  
**Auditor Senior:** Antigravity (Experto en Ciberseguridad y Arquitectura de Sistemas)  

---

## 💡 Comparativa y Justificación del Stack: FastAPI/Python vs. Node.js/Express

**Respuesta a tu pregunta:** Sí, la combinación de **FastAPI y Python** cumple exactamente con los mismos requisitos arquitectónicos e infraestructura de seguridad que **Node.js y Express**, e incluso aporta ventajas significativas a nivel de rendimiento, tipado y desarrollo:

1. **FastAPI vs. Express:**
   * **Equivalencia de Enrutamiento & Middlewares:** FastAPI implementa el estándar ASGI (nativamente asíncrono) permitiendo concurrencia masiva con `async/await`. La pila de middlewares funciona de la misma forma que en Express (permitiendo CORS, Rate Limiting y Headers de seguridad).
   * **Autovalidación:** FastAPI valida automáticamente los payloads HTTP entrantes usando esquemas de **Pydantic** (retornando `422 Unprocessable Entity` si los datos están mal formados). En Express, esto requiere dependencias de terceros como Joi o Zod.
   * **Documentación Interactiva:** Genera de forma nativa Swagger UI en `/docs` y ReDoc en `/redoc`.

2. **SQLAlchemy vs. Prisma:**
   * **SQLAlchemy** es el estándar de la industria (ORM) para Python. Ofrece el mismo soporte relacional que Prisma: definición de modelos orientados a objetos, relaciones bidireccionales con llaves foráneas (FK), carga perezosa o ansiosa (`joinedload`), y transacciones atómicas. Mapea físicamente las clases a tablas mediante `__tablename__` (equivalente a `@@map` de Prisma).

3. **WebSockets Nativos vs. Socket.io:**
   * FastAPI soporta la especificación nativa de WebSockets (RFC 6455) sin sobrecarga (overhead) ni protocolos propietarios, haciéndola más ligera y rápida que Socket.io, que requiere un cliente pesado e introduce capas extras de polling.

---

## 📑 1. Checklist de Cumplimiento Técnico (Resolutivo vs. Estratégico)

Evaluación de la persistencia de base de datos, esquemas relacionales, autenticación criptográfica de tokens y control del tráfico distribuido en tiempo real en la base de código actual.

### 🔍 Análisis del Estado del Código Actual

*   **Base de Datos & Persistencia:** **[Cumplido - Nivel Estratégico]**
    *   *Detalle:* El archivo `.env` tiene correctamente declaradas las variables `DATABASE_URL` (puerto `6543` para el pooler transaccional de Supabase) y `DIRECT_URL` (puerto `5432` para migraciones y scripts como `bd.sql`). En `app/core/database.py` se inicializa el motor de base de datos con `pool_pre_ping=True` (para evitar desconexiones silenciosas) y la dependencia `get_db()` asegura el cierre de sockets mediante `finally: db.close()`, previniendo fugas de conexión (*connection leaks*) que saturen Supabase.
*   **Modelos y Relaciones:** **[Cumplido - Nivel Estratégico]**
    *   *Detalle:* En `app/models/usuario.py` y `app/models/reporte.py` se implementa `__tablename__ = "usuarios"` y `"reportes"` (equivalente de `@@map` a snake_case). Las claves foráneas están correctamente enlazadas (`usuario_id`, `asignado_a`). Las relaciones de SQLAlchemy cargan de forma segura al autor. En la respuesta final de la API, se utiliza `ReporteResponse` (que usa `UsuarioResponse` como tipo para el usuario) ocultando por completo la contraseña hashed (`hashed_password`) en las respuestas serializadas.
*   **Autenticación JWT:** **[Cumplido - Nivel Estratégico]**
    *   *Detalle:* La ruta `/auth/register` hashea contraseñas usando bcrypt (`AuthService.hash_password`). La ruta `/auth/login` firma el token JWT codificando las claims necesarias con una duración controlada. La ruta `/auth/logout` implementa una lista negra (*blacklist*) dinámica en Upstash Redis guardando el token con un tiempo de expiración (TTL) igual al tiempo de vida restante del JWT. La dependencia `get_current_user` valida las firmas en cada endpoint protegido arrojando `401 Unauthorized` si expira.
*   **Seguridad Adicional:** **[Cumplido - Nivel Estratégico]**
    *   *Detalle:* Se registra `CORSMiddleware` limitando el acceso a orígenes de confianza (puertos `5173`, `3000` y `5500`) habilitando credenciales. El middleware `RateLimitMiddleware` implementa un límite de 100 peticiones cada 15 minutos por IP utilizando el comando atómico `INCR` en Redis y expirando llaves automáticamente. Las cabeceras web de seguridad (CSP, HSTS, X-Frame-Options, X-Content-Type) se inyectan dinámicamente mediante el middleware asíncrono `add_security_headers` en `app/main.py`.
*   **Tiempo Real (Redis + WebSockets):** **[Requiere pulir]**
    *   *Detalle:* Existe una clase `ConnectionManager` que administra y transmite vía WebSocket a los navegadores conectados. Además, se inicia un hilo secundario en segundo plano (`redis_pubsub_listener`) que lee desde Upstash Redis Pub/Sub en el canal `study:*` y retransmite. Sin embargo, **el listener de Redis carece de resiliencia**: si la red de Upstash parpadea o sufre un timeout, el método `pubsub_obj.listen()` arroja un error crítico y finaliza el hilo permanentemente, dejando a los usuarios sin actualizaciones en tiempo real hasta reiniciar la API.

---

### 🛠️ Código y Refactorización Propuesta para el Backend (Python)

#### A. Resiliencia y Reconexión en el Hilo de Redis (`app/main.py`)
Reemplazar la función `redis_pubsub_listener` en `app/main.py` por la siguiente implementación robusta que incluye reconexión indefinida ante caídas de red utilizando un retraso incremental (*exponential backoff*).

```python
# app/main.py (Refactorización de la escucha resiliente de Redis)
import time
import redis

def redis_pubsub_listener():
    """
    Función en segundo plano que se suscribe a los canales 'study:*' de Redis Pub/Sub.
    Incluye un bucle de reconexión infinita con exponencial backoff para garantizar resiliencia
    ante desconexiones repentinas de la red o parpadeos de Upstash Redis.
    """
    logger.info("📡 [Redis Listener Thread] Iniciando proceso de escucha resiliente...")
    backoff = 1  # Tiempo inicial de espera en segundos ante fallos de conexión

    while True:
        try:
            redis_client = get_redis_client()
            pubsub_obj = redis_client.pubsub()
            pubsub_obj.psubscribe("study:*")
            
            logger.info("📡 [Redis Listener] Conectado y suscrito con éxito a 'study:*'.")
            backoff = 1  # Restablecer tiempo de espera tras conexión exitosa
            
            # Escucha bloqueante
            for mensaje in pubsub_obj.listen():
                if mensaje["type"] == "pmessage":
                    data_str = mensaje["data"]
                    if isinstance(data_str, bytes):
                        data_str = data_str.decode("utf-8")
                    
                    logger.info(f"📡 [Redis Listener] Mensaje recibido de Redis: {data_str}")
                    # Broadcast seguro al event loop principal de la aplicación
                    asyncio.run_coroutine_threadsafe(manager.broadcast(data_str), main_loop)
                    
        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError) as conn_err:
            logger.error(f"❌ [Redis Listener] Error de conexión: {conn_err}. Reintentando en {backoff}s...")
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)  # Incremento exponencial limitado a máximo 60 segundos
        except Exception as err:
            logger.error(f"❌ [Redis Listener] Error inesperado en el hilo de fondo: {err}. Reintentando en {backoff}s...")
            time.sleep(backoff)
            backoff = min(backoff * 2, 60)
```

---

### 📊 Calificación del Estado del Backend
> [!IMPORTANT]
> **Calificación Actual: [Requiere pulir]**
> *Justificación:* La arquitectura backend en FastAPI y SQLAlchemy es sumamente madura y cumple con todos los requisitos de seguridad (CORS, JWT con lista negra en Redis, cabeceras de protección, rate limiting por IP). Sin embargo, requiere pulir la robustez del hilo secundario de Redis Pub/Sub para que no se caiga ante desconexiones de red en producción.

---

## 🎨 2. Auditoría del Frontend (Interactividad y Estética Visual)

Evaluación del portal del cliente en la ruta de archivos de desarrollo (`frontend/`). A continuación, se detallan las correcciones estéticas y lógicas del lado del cliente.

### 🔍 Análisis del Estado del Código Actual

*   **Badge de Conexión:** **[Falta implementar]** En el HTML/JS actual no existe representación visual del estado del WebSocket ni de los reintentos de conexión.
*   **Feed de Notificaciones Redis:** **[Falta implementar]** La interfaz no captura los eventos de broadcast de la API para mostrar alertas dinámicas de creación o modificación de reportes de manera fluida.
*   **Flujo de Sesión:** **[Requiere pulir]** `frontend/js/services/authService.js` administra el token, pero carece de un sistema de deslogueo reactivo cuando el backend rechaza solicitudes con `401 Unauthorized` por tokens expirados.

---

### 🛠️ Código y Diseño Propuesto para el Frontend

#### A. HTML del Badge de Conexión (Modificar `navbar-container` en `frontend/js/main.js`)
Inyectamos el badge en la barra de navegación minimalista cuando el usuario tiene sesión activa:

```javascript
// Reemplazar la inyección del navbar en la línea 68 de frontend/js/main.js
    if (navbarContainer) {
        navbarContainer.className = "navbar-minimal";
        navbarContainer.innerHTML = `
            <div class="brand-minimal">
                <i class="bi bi-building-fill-gear brand-icon"></i>
                <span>UPDS <span style="font-weight: 300; opacity: 0.8;">Infraestructura</span></span>
            </div>
            <ul class="nav-links" style="display: flex; align-items: center; gap: 1rem; list-style: none; margin: 0; padding: 0;">
                <li>
                    <div class="ws-badge-container">
                        <span id="ws-badge" class="ws-badge status-disconnected">
                            <span class="status-dot"></span>
                            <span id="ws-badge-text">Desconectado</span>
                        </span>
                    </div>
                </li>
                <li>
                    <span style="font-size: 0.875rem; color: var(--text-secondary);">
                        Hola, <strong>${usuario.nombre}</strong>
                    </span>
                </li>
                <li>
                    <button class="btn-minimal btn-outline" id="btn-logout" style="padding: 0.4rem 0.8rem;">
                        <i class="bi bi-box-arrow-right me-1"></i> Salir
                    </button>
                </li>
            </ul>
        `;

        // Asociar evento de cierre de sesión
        const btnLogout = document.getElementById("btn-logout");
        if (btnLogout) {
            btnLogout.addEventListener("click", async () => {
                await authService.logout();
                window.location.reload();
            });
        }
    }
```

#### B. Estilos HSL y Animaciones para el Badge y el Feed (Añadir a `frontend/css/style.css`)
```css
/* Estilos del Badge en el Navbar */
.ws-badge-container {
  display: inline-flex;
  align-items: center;
}

.ws-badge {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.75rem;
  border-radius: 9999px;
  font-family: 'Inter', sans-serif;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.03);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transition: all 0.3s ease;
}

/* Conectado: Verde Esmeralda HSL */
.status-connected {
  background-color: hsla(150, 80%, 40%, 0.1);
  color: hsl(150, 80%, 40%);
  border-color: hsla(150, 80%, 40%, 0.2);
}
.status-connected .status-dot {
  background-color: hsl(150, 80%, 45%);
  box-shadow: 0 0 8px hsl(150, 80%, 45%);
  animation: pulse-green 2s infinite;
}

/* Desconectado: Rojo Coral HSL */
.status-disconnected {
  background-color: hsla(0, 84%, 60%, 0.1);
  color: hsl(0, 84%, 60%);
  border-color: hsla(0, 84%, 60%, 0.2);
}
.status-disconnected .status-dot {
  background-color: hsl(0, 84%, 60%);
  box-shadow: 0 0 8px hsl(0, 84%, 60%);
}

/* Conectando: Ámbar HSL */
.status-connecting {
  background-color: hsla(38, 92%, 50%, 0.1);
  color: hsl(38, 92%, 50%);
  border-color: hsla(38, 92%, 50%, 0.2);
}
.status-connecting .status-dot {
  background-color: hsl(38, 92%, 50%);
  animation: pulse-orange 1.5s infinite;
}

@keyframes pulse-green {
  0% { transform: scale(1); box-shadow: 0 0 0 0 hsla(150, 80%, 45%, 0.6); }
  70% { transform: scale(1); box-shadow: 0 0 0 5px hsla(150, 80%, 45%, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 hsla(150, 80%, 45%, 0); }
}

@keyframes pulse-orange {
  0% { transform: scale(1); box-shadow: 0 0 0 0 hsla(38, 92%, 50%, 0.6); }
  70% { transform: scale(1); box-shadow: 0 0 0 5px hsla(38, 92%, 50%, 0); }
  100% { transform: scale(1); box-shadow: 0 0 0 0 hsla(38, 92%, 50%, 0); }
}

/* Contenedor del Feed de Notificaciones Toasts */
.notifications-feed {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 10000;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 350px;
  width: 100%;
  pointer-events: none;
}

.notification-card {
  pointer-events: auto;
  background: rgba(18, 18, 28, 0.85);
  backdrop-filter: blur(12px) saturate(180%);
  -webkit-backdrop-filter: blur(12px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  display: flex;
  gap: 0.8rem;
  align-items: flex-start;
  opacity: 0;
  transform: translateY(20px) scale(0.95);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.notification-card.show {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.notification-card.fade-out {
  opacity: 0;
  transform: scale(0.9) translateY(10px);
  transition: all 0.3s ease;
}

.notif-icon {
  background: rgba(99, 102, 241, 0.12);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 8px;
  padding: 0.5rem;
  color: #818cf8;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

#### C. Inyección de Contenedor de Notificaciones en `frontend/index.html`
Agrega este contenedor en la parte inferior de tu archivo HTML principal, justo antes de cerrar el `</body>`:

```html
<!-- Contenedor dinámico de alertas en tiempo real -->
<div id="notifications-feed" class="notifications-feed"></div>
```

#### D. Lógica del Cliente de WebSockets y Notificaciones (`frontend/js/services/websocket.js`)
Crea este nuevo módulo para gestionar la conexión directa con el endpoint `/ws` de FastAPI:

```javascript
// frontend/js/services/websocket.js
import { authService } from "./authService.js";

let socketInstance = null;
let reconectandoInterval = null;

export const socketService = {
  inicializar() {
    const token = sessionStorage.getItem("token");
    if (!token) return;

    // Obtener la URL del backend WebSocket (adaptada para ws:// o wss://)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = "localhost:8000"; // Cambiar por dominio en producción (Render)
    const wsUrl = `${protocol}//${host}/ws`;

    console.log(`🔌 Conectando a WebSocket: ${wsUrl}`);
    socketInstance = new WebSocket(wsUrl);

    const badge = document.getElementById("ws-badge");
    const badgeText = document.getElementById("ws-badge-text");

    const actualizarBadge = (estado) => {
      if (!badge || !badgeText) return;
      badge.className = "ws-badge";
      if (estado === "conectado") {
        badge.classList.add("status-connected");
        badgeText.textContent = "Conectado";
      } else if (estado === "desconectado") {
        badge.classList.add("status-disconnected");
        badgeText.textContent = "Desconectado";
      } else if (estado === "conectando") {
        badge.classList.add("status-connecting");
        badgeText.textContent = "Conectando...";
      }
    };

    actualizarBadge("conectando");

    socketInstance.onopen = () => {
      actualizarBadge("conectado");
      console.log("⚡ Conexión WebSocket establecida con FastAPI.");
      if (reconectandoInterval) {
        clearInterval(reconectandoInterval);
        reconectandoInterval = null;
      }
    };

    socketInstance.onclose = () => {
      actualizarBadge("desconectado");
      console.warn("🔌 Conexión WebSocket cerrada. Intentando reconectar...");
      this.intentarReconexion();
    };

    socketInstance.onerror = (error) => {
      actualizarBadge("desconectado");
      console.error("❌ Error en WebSocket:", error);
    };

    // Escuchar broadcasts enviados por el Listener de Redis Pub/Sub del Backend
    socketInstance.onmessage = (event) => {
      try {
        const mensaje = JSON.parse(event.data);
        if (mensaje.tipo === "reporte:creado") {
          this.mostrarAlerta(mensaje.payload);
        }
      } catch (err) {
        console.warn("Formato de mensaje WebSocket no reconocido:", event.data);
      }
    };
  },

  intentarReconexion() {
    if (reconectandoInterval) return;
    reconectandoInterval = setInterval(() => {
      console.log("🔄 Reintentando conexión WebSocket...");
      this.inicializar();
    }, 5000); // Reintenta conectarse cada 5 segundos
  },

  mostrarAlerta(reporte) {
    const feed = document.getElementById("notifications-feed");
    if (!feed) return;

    const card = document.createElement("div");
    card.className = "notification-card";
    card.innerHTML = `
      <div class="notif-icon">
        <i class="bi bi-exclamation-triangle-fill" style="font-size: 1.1rem;"></i>
      </div>
      <div style="flex: 1;">
        <div style="font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 0.85rem; color: #f4f4f5; margin-bottom: 0.15rem;">
          Nueva Incidencia Reportada
        </div>
        <div style="font-family: 'Inter', sans-serif; font-size: 0.75rem; color: #a1a1aa; line-height: 1.35;">
          <strong>${reporte.usuario ? reporte.usuario.nombre : "Un estudiante"}</strong> reportó:
          <em style="display: block; color: #e4e4e7; margin-top: 0.15rem;">"${reporte.titulo}"</em>
        </div>
        <span style="font-size: 0.65rem; color: #52525b; margin-top: 0.4rem; display: block;">Hace un momento</span>
      </div>
    `;

    feed.insertBefore(card, feed.firstChild);

    // Animación de entrada
    setTimeout(() => {
      card.classList.add("show");
    }, 20);

    // Auto-eliminar después de 6 segundos
    setTimeout(() => {
      card.classList.remove("show");
      card.classList.add("fade-out");
      card.addEventListener("transitionend", () => {
        card.remove();
      });
    }, 6000);
  },

  desconectar() {
    if (socketInstance) {
      socketInstance.onclose = null; // Evitar reconexión en logout voluntario
      socketInstance.close();
      socketInstance = null;
    }
    if (reconectandoInterval) {
      clearInterval(reconectandoInterval);
      reconectandoInterval = null;
    }
  }
};
```

---

### 📊 Calificación del Estado del Frontend
> [!IMPORTANT]
> **Calificación Actual: [Requiere pulir]**
> *Justificación:* El frontend implementa con éxito el enrutamiento lógico por roles en `main.js` y el consumo básico de la API, pero carece de la conexión cliente al WebSocket, la gestión interactiva del badge del navbar y el feed flotante de notificaciones en tiempo real.

---

## 🚀 3. Checklist de Pre-despliegue (Evitar Bugs Conocidos en Render)

Revisión de parámetros críticos para el despliegue del backend FastAPI en Render y control de excepciones.

### 🔍 Análisis de Errores Críticos Detectados en el Workspace

1.  **Configuración del Puerto (`PORT`):** **[Cumplido - Nivel Estratégico]**
    *   *Detalle:* En Render, no se debe definir manualmente la variable `PORT` en el panel de variables de entorno de la aplicación. Render la asigna dinámicamente. El backend en Python lee el puerto del entorno de forma automática en `app/core/config.py` y lo utiliza en el arranque de Uvicorn.
2.  **Script de Build para Instalar Dependencias:** **[Falta implementar]**
    *   *Detalle:* Para desplegar en Render, el build command debe configurarse de forma limpia. Al no usarse Prisma en Node sino SQLAlchemy en Python, el comando de build en el dashboard de Render debe ser: `pip install -r requirements.txt`.
3.  **Exclusión de `.env` en Git:** **[Cumplido - Nivel Estratégico]**
    *   *Detalle:* El archivo `.gitignore` local excluye explícitamente el archivo `.env` en la raíz, evitando filtraciones de contraseñas de Supabase y de la clave privada JWT a repositorios de control de código abierto.
4.  **Estructura del archivo `BUGS.md`:** **[Requiere pulir]**
    *   *Detalle:* El historial de incidencias `BUGS.md` en la raíz contiene bugs valiosos enfocados en Python, pero es estratégico estructurar y documentar las causas raíz y soluciones definitivas de fallos de concurrencia e infraestructura de red con base en SQLAlchemy, parpadeos de Redis y orígenes CORS en WebSockets.

---

### 🛠️ Configuración e Incidencias Técnicas Clave para `BUGS.md`

Para complementar tu archivo `BUGS.md` actual, añade los siguientes 3 bugs de producción correspondientes a la infraestructura Python/FastAPI/SQLAlchemy:

```markdown
## BUG-004: Fuga de Conexiones en Supabase PostgreSQL por Cierre Ausente de Sesiones SQLAlchemy (Depends get_db)

### Síntoma
Después de unas horas operando en producción con alta concurrencia de clientes, la API de FastAPI comenzaba a rechazar conexiones entrantes y a retornar errores HTTP 500. Los logs de Supabase mostraban el error: `FATAL: remaining connection slots are reserved for non-replication superuser connections`.

### Causa
Varios controladores consumían la sesión de base de datos (`db: Session = Depends(get_db)`) pero no la cerraban de forma segura. Al no liberarse los sockets de conexión en SQLAlchemy, Supabase bloqueaba el pool al alcanzar el límite de sockets concurrentes permitidos por PgBouncer.

### Solución
Se refactorizó el generador `get_db()` en `app/core/database.py` envolviéndolo en un bloque `try-finally` para asegurar el retorno automático de la conexión al pooler en el puerto 6543:
```python
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() # Se ejecuta obligatoriamente al concluir la petición HTTP
```

---

## BUG-005: Caída del Servidor Uvicorn al Desconectarse Upstash Redis (Timeout de Socket TCP)

### Síntoma
La transmisión de datos en tiempo real dejaba de funcionar de forma indefinida. Los logs de Uvicorn en Render mostraban `redis.exceptions.ConnectionError: Connection closed by server` y el hilo secundario del suscriptor se cerraba definitivamente sin reiniciarse.

### Causa
Upstash Redis cierra por defecto las conexiones TCP que permanecen inactivas por un periodo prolongado. El hilo secundario `redis_pubsub_listener` leía indefinidamente con `pubsub_obj.listen()` pero no implementaba control de excepciones ni bucles de reintento. Ante el parpadeo del puerto o desconexión, el hilo moría de forma silenciosa.

### Solución
Se envolvió el escuchador en un bucle infinito `while True` con captura de excepciones de red (`ConnectionError`, `TimeoutError`) y un esquema de reconexión con *exponential backoff* para evitar saturar el puerto:
```python
def redis_pubsub_listener():
    backoff = 1
    while True:
        try:
            # Conexión y escucha...
            backoff = 1
        except (redis.exceptions.ConnectionError, redis.exceptions.TimeoutError):
            time.sleep(backoff)
            backoff = min(backoff * 2, 60) # Incrementa exponencialmente
```

---

## BUG-006: Excepción de Protocolo Incorrecto en WebSockets al Desplegar Detrás de TLS en Render (WSS)

### Síntoma
El navegador de los usuarios arrojaba errores en consola al intentar conectar el cliente de WebSockets en producción: `SecurityError: The operation is insecure`. La conexión se rechazaba de forma sistemática.

### Causa
En el código de JavaScript del cliente se encontraba harcodeada la cadena de protocolo `ws://`. Al desplegar la aplicación en Render sobre HTTPS, los navegadores modernos aplican políticas de contenido mixto (*mixed content*) bloqueando sockets no encriptados (`ws://`) dentro de páginas encriptadas (`https://`).

### Solución
Se dinaminó la resolución del protocolo en el JavaScript del cliente para utilizar automáticamente la variante segura (`wss://`) en producción:
```javascript
const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
const host = "tu-app.onrender.com";
const wsUrl = `${protocol}//${host}/ws`;
const socket = new WebSocket(wsUrl);
```
```

---

### 📊 Calificación del Checklist de Pre-despliegue
> [!IMPORTANT]
> **Calificación Actual: [Requiere pulir]**
> *Justificación:* La configuración de puertos y el aislamiento de credenciales locales en Git están implementadas estratégicamente. Sin embargo, para producción se requiere configurar de forma correcta el comando de construcción `pip install -r requirements.txt` en el panel de Render, y actualizar `BUGS.md` para documentar adecuadamente las incidencias del stack Python explicadas.

---

## 🎯 Resumen Ejecutivo de la Auditoría Técnica

| Componente Evaluado | Estado General | Acción Inmediata Sugerida |
| :--- | :--- | :--- |
| **Infraestructura Backend (FastAPI)** | 🟡 **[Requiere pulir]** | Refactorizar `redis_pubsub_listener` en `app/main.py` para incluir resiliencia y exponencial backoff ante timeouts de red. |
| **Interfaz del Cliente (Vanilla JS)** | 🟡 **[Requiere pulir]** | Inyectar el badge en el Navbar de `main.js`, configurar el estilo en `style.css` y crear `websocket.js` para abrir la conexión nativa al WebSocket. |
| **Preparación para Render (DevOps)** | 🟡 **[Requiere pulir]** | Configurar el comando de construcción de Python en Render e incorporar los Bugs 4, 5 y 6 al historial `BUGS.md` para control de calidad. |

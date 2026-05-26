# Reportes de Infraestructura Universitaria - Backend

Este proyecto contiene la API backend y el sistema de mensajería para la plataforma de **Reportes de Infraestructura Universitaria**. El sistema está diseñado siguiendo principios de **Arquitectura Limpia (Clean Architecture)** orientada a capas y estructurado de forma modular en Python.

La plataforma permite registrar incidencias y averías de la infraestructura del campus universitario, realizar seguimiento de su estado (pendiente, en proceso, resuelto) y publicar eventos asíncronos en tiempo real mediante Redis.

---

## 🛠️ Estructura del Proyecto y Capas

El backend se organiza bajo la siguiente estructura de directorios, donde cada capa tiene una única responsabilidad:

```text
├── app/                             # Directorio principal del backend
│   ├── __init__.py                  # Inicialización y comentarios del módulo app
│   ├── main.py                      # Punto de entrada principal (FastAPI app, middlewares, routers)
│   ├── api/                         # Capa de transporte y enrutamiento web
│   │   ├── __init__.py
│   │   └── endpoints/               # Controladores HTTP (FastAPI APIRouter)
│   │       ├── __init__.py
│   │       └── reportes.py          # Rutas CRUD de la API REST para los reportes
│   ├── core/                        # Núcleo y utilidades del sistema
│   │   ├── __init__.py
│   │   └── config.py                # Carga segura y validación de variables de entorno (.env)
│   ├── models/                      # Capa de datos / Entidades de dominio
│   │   ├── __init__.py
│   │   └── reporte.py               # Definición del Modelo SQLAlchemy para la base de datos relacional
│   ├── schemas/                     # Capa de validación / DTOs (Data Transfer Objects)
│   │   ├── __init__.py
│   │   └── reporte.py               # Modelos Pydantic para validar entradas y formatear respuestas
│   ├── services/                    # Capa de lógica de negocio (Servicios)
│   │   ├── __init__.py
│   │   └── reportes.py              # Reglas de negocio y persistencia temporal en memoria (modo académico)
│   └── redis/                       # Capa de infraestructura externa (Mensajería)
│       ├── __init__.py
│       └── client.py                # Inicialización del Pool de conexiones para el cliente de Redis
├── subscriber.py                    # Script suscriptor independiente de Redis Pub/Sub (procesa eventos)
├── .env                             # Configuración y variables del entorno local
├── .gitignore                       # Exclusión de archivos y dependencias para Git
├── requirements.txt                 # Archivo de dependencias del proyecto
└── README.md                        # Esta documentación
```

### Responsabilidad de las Capas
1. **Rutas (api/endpoints/)**: Reciben las peticiones HTTP externas, validan la entrada de datos mediante los esquemas y llaman a los servicios. No contienen lógica de negocio.
2. **Servicios (services/)**: Contienen las reglas y flujos de negocio del sistema. Son independientes del framework de la API y de cómo se almacenan físicamente los datos.
3. **Modelos (models/)**: Representan las entidades de datos mapeadas con la base de datos relacional mediante el ORM (SQLAlchemy).
4. **Esquemas (schemas/)**: Modelos de Pydantic que sirven para validar los JSON que recibe o devuelve la API, garantizando contratos de datos limpios.
5. **Configuración (core/config.py)**: Lee y tipa de manera estricta las variables del entorno, previniendo errores por variables faltantes.

---

## 🚀 Requisitos e Instalación (Windows)

Sigue estos pasos en la terminal (PowerShell o CMD) dentro del directorio raíz del proyecto:

### 1. Activar el Entorno Virtual

El entorno virtual `.venv` ya ha sido creado en el directorio raíz. Para activarlo en Windows ejecuta:

*   **PowerShell:**
    ```powershell
    .venv\Scripts\Activate.ps1
    ```
*   **Símbolo del Sistema (CMD):**
    ```cmd
    .venv\Scripts\activate.bat
    ```

*(Si PowerShell muestra un error de políticas de ejecución, puedes usar temporalmente CMD o habilitar la ejecución con `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process` en tu terminal).*

### 2. Instalar Dependencias

Las dependencias principales ya se instalaron durante la inicialización automática. Si necesitas reinstalarlas o ejecutar en otro equipo, corre:

```bash
pip install -r requirements.txt
```

Las dependencias clave utilizadas son:
*   `fastapi`: Framework web para construir APIs REST.
*   `uvicorn`: Servidor ASGI de alto rendimiento para ejecutar FastAPI.
*   `pydantic-settings`: Manejo avanzado y seguro de configuraciones mediante Pydantic.
*   `sqlalchemy`: ORM para el mapeo objeto-relacional (preparado para PostgreSQL).
*   `redis`: Cliente de Python para interactuar con la base de datos y mensajería en memoria Redis.

---

## ⚙️ Configuración del Entorno (`.env`)

El archivo `.env` inicial en la raíz contiene las siguientes variables que puedes editar según tu infraestructura local:
```env
PORT=8000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:PENDIENTE@localhost:5432/infra_db
REDIS_URL=redis://default:PENDIENTE@PENDIENTE:6379
```

---

## 🏃 Ejecución del Proyecto

### 1. Levantar la API Backend (Servidor FastAPI)

Ejecuta el servidor web local con recarga automática para desarrollo:

```bash
uvicorn app.main:app --reload --port 8000
```
*   La API estará disponible en: [http://localhost:8000](http://localhost:8000)
*   La documentación interactiva y pruebas de endpoints (Swagger UI) en: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Levantar el Suscriptor de Eventos (Opcional - Redis)

Si tienes un servidor de Redis corriendo localmente o en la nube, puedes levantar el proceso del suscriptor asíncrono para escuchar cambios en tiempo real:

```bash
python subscriber.py
```
*   *Nota: Si Redis no está encendido, la API backend funcionará perfectamente en su almacenamiento temporal de memoria sin lanzar excepciones fatales.*

---

## 🌐 Despliegue en Producción (Render)

Esta sección detalla los parámetros de configuración y los conceptos técnicos clave para desplegar la Plataforma de Reportes de Infraestructura Universitaria en la nube utilizando **Render**.

### 🔗 URL Pública del Proyecto
*   **Enlace de Producción:** (Pendiente de despliegue en Render, ej: `https://p4-infraestructura.onrender.com/docs`)

### 🛠️ Configuración del Servicio en Render
Al crear un nuevo **Web Service** en Render, utiliza la siguiente configuración en su panel de administración:

*   **Runtime:** `Python 3`
*   **Build Command (Comando de Construcción):**
    ```bash
    pip install -r requirements.txt
    ```
*   **Start Command (Comando de Arranque):**
    ```bash
    uvicorn app.main:app --host 0.0.0.0 --port 8000
    ```
    *(Nota: El servidor lee de forma segura e interna la variable `PORT` proporcionada dinámicamente por la plataforma de Render, ignorando el valor por defecto si se especifica en el entorno de producción).*

### 🔑 Variables de Entorno Requeridas (Environment Variables)
Configura las siguientes variables en la sección **Environment** en Render:

1.  `PORT`: Definida automáticamente por Render, indica el puerto asignado para la ejecución.
2.  `NODE_ENV`: Debe configurarse en `production` para optimizar la velocidad y desactivar el reload automático.
3.  `DATABASE_URL`: URL de conexión a la base de datos PostgreSQL de producción.
4.  `REDIS_URL`: URL de conexión segura al servidor Redis (Upstash) de producción.

---

### 🔍 Explicación Técnica: ¿Por qué usar Host '0.0.0.0' en lugar de '127.0.0.1'?

En redes y virtualización de contenedores, la dirección a la que se enlaza (bind) el servidor web define el alcance de las peticiones que este puede recibir:

*   **`127.0.0.1` (Localhost / Loopback):**
    Si configuramos uvicorn para escuchar en `127.0.0.1`, el servidor web solo aceptará peticiones de red originadas **dentro del mismo contenedor/máquina virtual**. Cualquier petición que provenga de internet o de los balanceadores de carga externos de Render será rechazada de inmediato, haciendo que el servicio sea inaccesible.
*   **`0.0.0.0` (All Interfaces):**
    Configurar el host en `0.0.0.0` le indica al servidor web que escuche peticiones en **todas las interfaces de red disponibles** en el contenedor. Esto permite que la infraestructura y enrutadores de Render (los cuales mapean el tráfico público de internet hacia el puerto interno del contenedor) puedan reenviar exitosamente el tráfico de los clientes externos a la aplicación FastAPI.


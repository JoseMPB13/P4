# Issue Realtime
### Plataforma Distribuida de Alta Disponibilidad para el Reporte y Seguimiento de Fallas en Tiempo Real (UPDS 2026)

**Issue Realtime** es un sistema distribuido de nivel empresarial desarrollado para la gestión digital instantánea de incidencias, fallas y problemas de infraestructura física dentro del campus universitario. Permite reportar problemas, adjuntar evidencias multimedia (fotos en la nube), asignar técnicos encargados de mantenimiento y presenciar la resolución de fallas en tiempo real de forma reactiva y sin recargar la página.

---

## 🚀 Enlaces de Producción
*   **Servicios Web API / Frontend (Render)**: [https://p4-issue-realtime.onrender.com](https://p4-issue-realtime.onrender.com)
*   **Documentación Interactiva (OpenAPI/Swagger)**: [https://p4-issue-realtime.onrender.com/docs](https://p4-issue-realtime.onrender.com/docs)
*   **Estado de Salud del Backend (Healthcheck)**: [https://p4-issue-realtime.onrender.com/health](https://p4-issue-realtime.onrender.com/health)

---

## 🛠️ Pila Tecnológica (Tech Stack)
*   **Lenguaje**: Python 3.11+
*   **Backend Framework**: FastAPI (Programación asíncrona ASGI)
*   **Persistencia Relacional**: Supabase PostgreSQL (Motor transaccional)
*   **Mapeador ORM**: SQLAlchemy 2.0 (Carga ansiosa optimizada con `joinedload`)
*   **Mensajería y Caché**: Upstash Redis (Pub/Sub distributed events y Caché con expiración TTL)
*   **Autenticación**: JSON Web Tokens (PyJWT) con encriptación Bcrypt para credenciales
*   **Seguridad**: Middleware de Rate Limiting por IP (Redis) y cabeceras HTTP de seguridad (Helmet equivalent)
*   **Infraestructura como Código (IaC)**: AWS CloudFormation (S3, DynamoDB con TTL y SSM Parameter Store)

---

## 📐 Arquitectura y Flujo del Sistema Distribuido

La arquitectura del sistema está diseñada siguiendo principios de bajo acoplamiento y procesamiento en segundo plano (asíncrono):

```text
  [ Cliente Frontend SPA ] <======= (WebSockets /ws) ========+
       |                                                     |
  (Petición HTTP)                                            |
       |                                                     |
       v                                                     |
  [ API FastAPI Enrutador ]                                  |
       |                                                     |
  (Transacción Relacional)                                   |
       |                                                     |
       v                                                     |
  [ Supabase PostgreSQL ]                                    |
       |                                                     |
  (Confirmación commit)                                      |
       |                                                     |
       v                                                     |
  [ FastAPI BackgroundTasks ]                                |
       |                                                     |
  (Publica Evento en Canal)                                  |
       |                                                     |
       v                                                     |
  [ Upstash Redis Pub/Sub ]                                  |
       |                                                     |
  (Captura Evento y difunde)                                 |
       +=====================================================+
       |
  (Escucha independiente)
       v
  [ subscriber.py (Consola Auditoría) ]
```

### Flujos Clave de la Plataforma:
1.  **Seguridad y Autenticación**: Al hacer login se emite un JWT. En las rutas privadas, la dependencia `get_current_user` valida el token y verifica en Redis si este no ha sido revocado en una lista negra por un `/logout` reciente.
2.  **Transmisión de Eventos en Caliente**: Tras confirmar la persistencia de un reporte en base de datos, FastAPI delega de forma asíncrona la invalidación de la caché y la publicación en Redis Pub/Sub a `BackgroundTasks`. El hilo daemon del servidor lee el evento y ejecuta un broadcast por WebSockets hacia los clientes activos, quienes actualizan su interfaz local y muestran un destello visual (`.row-highlight`) en la fila correspondiente.
3.  **Aislamiento de Auditoría**: El script `subscriber.py` actúa como consola de auditoría dedicada, capturando los eventos del campus desde Redis de forma externa y sin bloquear al backend web.

---

## 📂 Estructura del Repositorio
Para una revisión en profundidad de los módulos y responsabilidades de las carpetas, consulte el archivo [docs/GUIA_GENERAL_PROYECTO.md](file:///c:/Users/josem/Desktop/pppp/docs/GUIA_GENERAL_PROYECTO.md).

---

## 💻 Guía de Despliegue Local

Siga los siguientes pasos para instalar y ejecutar **Issue Realtime** en su máquina de desarrollo local:

### 1. Clonar el repositorio y configurar el entorno
Abra una terminal en el directorio del proyecto y cree un entorno virtual de Python:
```powershell
# Crear entorno virtual
python -m venv .venv

# Activar el entorno virtual en Windows
.venv\Scripts\activate
```

### 2. Instalar dependencias del proyecto
```powershell
pip install -r requirements.txt
```

### 3. Configuración de Variables de Entorno
Cree un archivo llamado `.env` en la raíz del proyecto basándose en la siguiente plantilla:
```ini
PORT=8000
NODE_ENV=development

# Conexión dual de base de datos relacional (Supabase PostgreSQL)
# Puerto 6543 (PgBouncer Pooler) para tráfico concurrente del backend
DATABASE_URL=postgresql://postgres:[PASSWORD]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=yp
# Puerto 5432 (Conexión Directa) para la inicialización DDL (bd.sql)
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.sglshnnttwgjlsgkhrto.supabase.co:5432/postgres?sslmode=require

# URL de Upstash Redis para Caché y Mensajería Pub/Sub
REDIS_URL=rediss://default:[TOKEN]@sa-east-1-redis.upstash.io:6379

# Credenciales de Supabase Storage para resguardo fotográfico
SUPABASE_URL=https://sglshnnttwgjlsgkhrto.supabase.co
SUPABASE_KEY=[API_SERVICE_KEY]
SUPABASE_BUCKET=infraestructura-fotos

# Variables para tokens de seguridad JWT
JWT_SECRET=supersecret_jwt_key_academic_level_2026
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### 4. Simular Infraestructura en la Nube de AWS (LocalStack)
Para validar la arquitectura de infraestructura declarativa con Docker localmente:

1.  Asegúrese de tener **Docker** iniciado.
2.  Levante LocalStack usando docker-compose o la imagen oficial:
    ```bash
    docker run --rm -it -p 4566:4566 -p 4510-4559:4510-4559 localstack/localstack
    ```
3.  Despliegue la plantilla de CloudFormation en el entorno AWS simulado:
    ```bash
    awslocal cloudformation create-stack --stack-name stack-infraestructura --template-body file://cloudformation/template.yaml
    ```
4.  Compruebe que los recursos (Bucket de S3 y Tabla DynamoDB con TTL) se crearon correctamente:
    ```bash
    awslocal cloudformation describe-stacks --stack-name stack-infraestructura
    ```

### 5. Iniciar la aplicación en modo desarrollo
Ejecute el servidor de desarrollo web mediante Uvicorn:
```powershell
uvicorn app.main:app --reload --port 8000
```
La aplicación se iniciará en [http://localhost:8000](http://localhost:8000). 
- Acceso al Frontend: [http://localhost:8000/](http://localhost:8000/)
- Acceso a Documentación interactiva de endpoints: [http://localhost:8000/docs](http://localhost:8000/docs)

### 6. Ejecutar la Consola de Auditoría (Suscriptor de Eventos)
En otra terminal separada del sistema operativo (manteniendo el entorno virtual activo):
```powershell
python subscriber.py
```
Esta consola mostrará los logs de eventos estructurados en caliente a medida que cree o edite reportes en la aplicación web.

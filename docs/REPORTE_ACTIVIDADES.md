# Reporte de Actividades Curriculares - Programación IV (UPDS 2026)
## Proyecto: **Issue Realtime** (Gestión de Falla e Infraestructura en Tiempo Real)

Este documento detalla la resolución técnica y la justificación pedagógica de las actividades evaluativas definidas en el plan de estudios de la asignatura. Se desglosa cada bloque curricular relacionando sus requerimientos con el funcionamiento y la implementación precisa en nuestra base de código basada en Python y FastAPI.

---

## Bloque 1: APIs REST y Operaciones CRUD de Alto Rendimiento

### 1. Requerimiento del PDF Académico
El estudiante debe diseñar e implementar una interfaz de programación de aplicaciones (API) bajo el estilo de arquitectura REST para realizar operaciones de creación, lectura, actualización y eliminación (CRUD) de problemas o fallas de infraestructura en el campus. La API debe responder con formatos JSON estructurados, códigos de estado HTTP semánticos y un control robusto de errores transaccionales en la capa persistente.

### 2. Explicación Conceptual y Funcionamiento General
Una **API REST** (*Representational State Transfer*) es un estilo de arquitectura de software para sistemas distribuidos que utiliza el protocolo HTTP para la transferencia de representaciones de recursos.
*   **Analogía Informática**: Pensemos en un restaurante elegante.
    - El **Cliente (Frontend)** es el comensal.
    - El **Servidor (Backend)** es la cocina.
    - La **API REST** es el menú y el camarero. El comensal no entra a la cocina a buscar la comida (la base de datos); en su lugar, hace un pedido específico (GET, POST, PUT, DELETE) al camarero, quien le devuelve el plato exacto formateado en un plato estándar (JSON).
*   **Códigos de Estado**:
    - `200 OK`: El pedido se entregó con éxito.
    - `201 Created`: Un plato nuevo ha sido cocinado y servido.
    - `400 Bad Request`: El comensal pidió un ingrediente que no existe o especificó mal la comanda.
    - `401 Unauthorized`: El comensal intenta consumir sin haberse identificado al entrar.
    - `404 Not Found`: El plato solicitado se ha agotado o no está en la carta.
    - `502 Bad Gateway`: La cocina tuvo un cortocircuito con el proveedor de gas (error de base de datos ORM).

### 3. Implementación Detallada en Python/FastAPI
En nuestro proyecto, la arquitectura REST de Node.js (Express/Prisma) se tradujo a un diseño limpio orientado a capas con FastAPI y SQLAlchemy.

*   **Rutas de Enrutamiento**: Declaradas usando `APIRouter` en [app/api/endpoints/reportes.py](file:///c:/Users/josem/Desktop/pppp/app/api/endpoints/reportes.py).
    - **GET `/api/reportes/`** (Línea 141): Obtiene el listado completo llamando a `ReporteService.listar_todos`.
    - **GET `/api/reportes/{id}`** (Línea 185): Obtiene un reporte según su ID entero único.
    - **POST `/api/reportes/`** (Línea 202): Recibe un formulario multipart/form-data, procesa de forma segura el archivo adjunto (evidencia fotográfica) y crea la falla.
    - **PUT `/api/reportes/{id}`** (Línea 290): Permite a administradores o técnicos alterar el estado (pendiente, en proceso, resuelto) o la prioridad.
    - **DELETE `/api/reportes/{id}`** (Línea 364): Borra físicamente el registro de la base de datos relacional.
*   **Validación de Contratos y DTOs**: Manejados en la capa de esquemas mediante Pydantic en [app/schemas/reporte.py](file:///c:/Users/josem/Desktop/pppp/app/schemas/reporte.py). Las clases `ReporteCreate`, `ReporteUpdate` y `ReporteResponse` actúan como filtros estrictos de entrada y salida de datos.
*   **Control de Excepciones ORM**: En la capa de servicios ([app/services/reportes.py](file:///c:/Users/josem/Desktop/pppp/app/services/reportes.py)), cada consulta de escritura se envuelve en bloques `try-except SQLAlchemyError`. Si la transacción de base de datos falla, se ejecuta inmediatamente `db.rollback()` (Líneas 219, 282, 301) para resguardar la consistencia de Supabase PostgreSQL, y se propaga un error HTTP `502 Bad Gateway` controlado hacia la capa externa.

---

## Bloque 2: Redis Pub/Sub, Asincronía y Tiempo Real (Canales del Campus)

### 1. Requerimiento del PDF Académico
El sistema distribuido debe notificar de inmediato a los múltiples clientes y dashboards conectados cuando ocurre un evento de infraestructura. Las operaciones de red externas o mensajería no deben demorar la respuesta de la API REST. Se debe desacoplar el procesamiento mediante un bróker de mensajería (Redis Pub/Sub) con canales normativos estrictos del campus y contar con un script independiente de consola para auditar los logs de eventos.

### 2. Explicación Conceptual y Funcionamiento General
El patrón **Pub/Sub** (*Publicador/Suscriptor*) es un modelo de comunicación por paso de mensajes donde los remitentes (publicadores) no dirigen los mensajes directamente a receptores específicos (suscriptores), sino que los clasifican en canales sin saber quiénes los recibirán.
*   **Analogía Informática**: Pensemos en una estación de radio.
    - La **API REST (Publicador)** transmite música en una frecuencia específica (canal de Redis).
    - Múltiples **Receptores/Usuarios (Suscriptores)** sintonizan esa frecuencia desde su automóvil o casa. La estación de radio emite la señal una sola vez y no le importa cuántas personas la estén escuchando ni interrumpe su transmisión de audio para validar a cada oyente individual.
    - **FastAPI BackgroundTasks**: Es como tener un asistente de la estación de radio que se encarga de empaquetar el disco y guardarlo en el archivo histórico de fondo mientras el locutor sigue transmitiendo en vivo sin pausas.

### 3. Implementación Detallada en Python/FastAPI
*   **Desacoplamiento de Latencia en Endpoints**: Inyectamos la clase `BackgroundTasks` de FastAPI en los endpoints de escritura de [app/api/endpoints/reportes.py](file:///c:/Users/josem/Desktop/pppp/app/api/endpoints/reportes.py). En lugar de esperar síncronamente a que Redis reciba la publicación, la API confirma la operación de base de datos y agenda la llamada a `publicar_y_limpiar_cache` (Línea 54) en un hilo de fondo asíncrono, respondiendo al cliente HTTP de forma instantánea.
*   **Publicación de Eventos en Canales del Campus**: Las tareas de fondo publican payloads JSON serializados en los siguientes canales específicos de Upstash Redis:
    - `"campus:reporte:nuevo"` (Línea 275) al registrar reportes.
    - `"campus:estado:actualizado"` (Líneas 350, 471) al cambiar estados o ingresar notas.
    - `"campus:resuelto"` (Línea 350) cuando el estado final es `"resuelto"`.
    - `"campus:reporte:eliminado"` (Línea 388) al borrar.
*   **Retransmisión a Clientes (WebSocket listener)**: En [app/main.py](file:///c:/Users/josem/Desktop/pppp/app/main.py), iniciamos un hilo secundario persistente (`redis_pubsub_listener`, Línea 99) que actúa como demonio suscriptor en el patrón `"campus:*"` y retransmite los mensajes al pool de WebSockets activos administrados por `ConnectionManager` (Línea 69).
*   **Auditoría Independiente**: El archivo autónomo de consola [subscriber.py](file:///c:/Users/josem/Desktop/pppp/subscriber.py) se ejecuta de forma externa y aislada de FastAPI para capturar los mismos eventos en una terminal de administración.

---

## Bloque 3: Seguridad, Autenticación JWT y Persistencia Relacional

### 1. Requerimiento del PDF Académico
El sistema escolar debe restringir el acceso a las funciones mutantes (creación, edición y borrado) únicamente a usuarios autenticados. Las contraseñas deben estar cifradas criptográficamente. Al iniciar sesión, se debe emitir un token JWT temporal y stateless. Para garantizar la seguridad ante robos de credenciales, el sistema debe proveer una invalidación de sesión (Logout) mediante una lista negra distribuida de tokens con tiempo de expiración (TTL) automático en Redis.

### 2. Explicación Conceptual y Funcionamiento General
*   **Hasheo con Sal (Salting)**: Hashear una clave convierte el texto plano en una huella criptográfica unidireccional irreversible. Añadir una "sal" (*salt*) es inyectar bytes aleatorios únicos a cada contraseña antes de procesarla, garantizando que dos claves iguales generen firmas distintas para anular ataques de diccionario.
*   **Token JWT**: Un *JSON Web Token* es una credencial compacta y autónoma que viaja en la cabecera HTTP.
    - **Analogía Informática**: Es como una pulsera de pase VIP en un festival de música. El guardia de seguridad (FastAPI) no tiene que ir a la oficina central (base de datos) cada vez que entras a una zona exclusiva; simplemente mira la pulsera, verifica que el sello criptográfico sea auténtico, que no haya caducado (fecha exp) y te permite pasar.
*   **Lista Negra (Blacklist) en Redis**: Siguiendo la analogía de la pulsera VIP: si pierdes la pulsera, el festival anota su número de serie en una pizarra en la puerta (Blacklist en Redis). Si un intruso intenta usar tu pulsera perdida, el guardia mira la pizarra (consulta de Redis en microsegundos con expiración automática TTL al terminar el día) y le deniega el paso.

### 3. Implementación Detallada en Python/FastAPI
*   **Criptografía con Bcrypt**: Implementada en [app/services/auth.py](file:///c:/Users/josem/Desktop/pppp/app/services/auth.py).
    - `hash_password` (Línea 24) utiliza `bcrypt.gensalt()` y `bcrypt.hashpw` para generar hashes seguros guardados en Supabase PostgreSQL.
    - `verificar_password` (Línea 43) utiliza `bcrypt.checkpw` para realizar comparaciones seguras de contraseñas.
*   **Emisión y Validación de JWT (PyJWT)**:
    - En [app/api/endpoints/auth.py:L83](file:///c:/Users/josem/Desktop/pppp/app/api/endpoints/auth.py#L83), el endpoint `/login` valida las credenciales y llama a `AuthService.crear_access_token` ([app/services/auth.py:L62](file:///c:/Users/josem/Desktop/pppp/app/services/auth.py#L62)) para codificar claims (`sub`, `id`, `rol`, `nombre`) y firmar el JWT con expiración temporal.
    - En [app/api/endpoints/reportes.py:L79](file:///c:/Users/josem/Desktop/pppp/app/api/endpoints/reportes.py#L79), la dependencia `get_current_user` valida el token extrayendo la cabecera. Si falla la firma o el tiempo expira, lanza `HTTPException(401)`.
*   **Logout y Lista Negra en Redis**:
    - En `/logout` ([app/api/endpoints/auth.py:L132](file:///c:/Users/josem/Desktop/pppp/app/api/endpoints/auth.py#L132)), decodificamos el token, calculamos el TTL restante respecto a la fecha de expiración (`exp`) y lo registramos en Redis con la instrucción atómica `redis_client.setex(f"blacklist:{token}", ttl, "true")`.
    - En `get_current_user` ([app/api/endpoints/reportes.py:L93](file:///c:/Users/josem/Desktop/pppp/app/api/endpoints/reportes.py#L93)), antes de procesar el token, consultamos `redis_client.exists(f"blacklist:{token}")`. Si coincide, se deniega la petición de forma instantánea.

---

## Bloque 4: Cloud Computing e Infraestructura como Código (IaC)

### 1. Requerimiento del PDF Académico
La infraestructura de la aplicación debe estar completamente definida mediante código de configuración declarativo para permitir despliegues replicables en la nube (AWS), simulando su aprovisionamiento localmente. Se debe declarar un bucket de almacenamiento de archivos adjuntos (S3), una base de datos NoSQL de alta velocidad para logs de auditoría (DynamoDB) con TTL configurado y un parámetro centralizado en el almacén de configuración (SSM Parameter Store).

### 2. Explicación Conceptual y Funcionamiento General
La **Infraestructura como Código (IaC)** es el proceso de aprovisionar y gestionar recursos de infraestructura de red y computación mediante archivos de definición legibles por máquina, en lugar de interactuar de forma manual con las consolas web de los proveedores cloud.
*   **Analogía Informática**: Pensemos en un plano de construcción 3D arquitectónico.
    - En lugar de ir ladrillo por ladrillo construyendo la casa a mano (creando buckets y tablas haciendo clics en la consola de AWS), le entregas el plano de diseño digital a una impresora 3D industrial (**AWS CloudFormation**). La impresora lee el plano YAML y levanta los muros (S3), los interruptores (DynamoDB) y la tubería de gas (SSM Parameter Store) en pocos minutos de forma exacta. Si quieres construir otra casa igual en otro país (entorno de pruebas o producción), simplemente vuelves a enviar el mismo archivo.

### 3. Implementación Detallada en Python/FastAPI
Nuestra definición de infraestructura se encuentra centralizada en la plantilla declarativa de AWS CloudFormation en [cloudformation/template.yaml](file:///c:/Users/josem/Desktop/pppp/cloudformation/template.yaml).

*   **Recursos AWS Declarados**:
    - **`ReportesAdjuntosBucket` (`AWS::S3::Bucket`)** (Línea 23): Bucket parametrizado por el ambiente (`development`/`production`) para resguardar las evidencias fotográficas de los reportes. Cuenta con versión de objetos activa para resguardo histórico y cifrado en reposo AES256 por defecto.
    - **`ReportesAuditoriaTabla` (`AWS::DynamoDB::Table`)** (Línea 43): Tabla NoSQL estructurada con clave de partición (`eventId`) y ordenación temporal (`timestamp`). Incorpora la propiedad `TimeToLiveSpecification` (Línea 65) activada en el campo `expirationTime` para la purga automática de logs de auditoría sin generar sobrecostos de procesamiento.
    - **`ApiUrlParameter` (`AWS::SSM::Parameter`)** (Línea 70): Clave en SSM Parameter Store para inyectar y centralizar de forma segura la URL del backend escolar hacia el frontend.
*   **Orquestación Local (LocalStack)**: A través de Docker, se simulan estas APIs de AWS de forma local sin requerir credenciales físicas reales, permitiendo probar la creación de la pila de recursos utilizando comandos como:
    ```bash
    awslocal cloudformation create-stack --stack-name stack-infraestructura --template-body file://cloudformation/template.yaml
    ```

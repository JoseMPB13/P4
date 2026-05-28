# Auditoría de Calidad de Software: Historial de Incidencias Corregidas (BUGS.md)

Este documento detalla el análisis de calidad y la auditoría técnica de los fallos críticos resueltos durante las fases de refactorización de la plataforma de "Reportes de Infraestructura Universitaria". Cada reporte de error sigue los estándares profesionales de Aseguramiento de la Calidad (QA).

---

## BUG-001: Inconsistencia y Volatilidad de Datos por Persistencia en Memoria RAM

### Síntoma
Cada vez que el servidor backend (Uvicorn) se reiniciaba de forma planificada o por un fallo imprevisto, todos los reportes de infraestructura creados por los estudiantes se perdían por completo. Asimismo, no era posible realizar consultas consistentes desde múltiples instancias distribuidas de la API, ya que cada worker mantenía un estado independiente del listado de reportes.

### Causa
La persistencia de los datos estaba delegada en una lista estática en memoria (`self._reportes`) dentro de la clase `ReporteService`. Esto violaba el principio de persistencia y durabilidad (propiedades ACID), limitando el sistema a un ámbito estrictamente volátil.

### Solución
Se eliminó la lista en memoria y se implementó una base de datos relacional persistente en **PostgreSQL (vía Supabase)** gestionada a través del ORM **SQLAlchemy**. Se creó la dependencia de sesión transaccional `get_db()` con un patrón seguro de *context manager* (`try-finally`) para cerrar de forma determinista cada conexión al pooler y evitar fugas de puertos en el servidor de base de datos.

### Aprendizaje
Las aplicaciones de nivel de producción bajo arquitecturas REST deben ser **stateless** (sin estado local). Toda persistencia de entidades de negocio debe ser delegada a un motor de base de datos físico externo, asegurando la durabilidad de la información y facilitando el escalado horizontal de la API.

---

## BUG-002: Vulnerabilidad en Python 3.12+ por Funciones de Tiempo Deprecadas

### Síntoma
Durante la fase de compilación y despliegue del sistema bajo entornos de ejecución modernos (Python 3.12+), se generaban advertencias de obsolescencia (*DeprecationWarnings*). Además, las marcas de tiempo almacenadas de las incidencias carecían de huso horario (*naive datetime*), lo que provocaba inconsistencias de ordenamiento cronológico cuando los clientes consumían la API desde distintas zonas geográficas.

### Causa
El uso reiterado del método nativo `datetime.utcnow()` en la definición de la fecha de creación del modelo (`created_at`) y en los manejadores globales de excepciones. En Python 3.12+, esta función fue declarada obsoleta debido a que retorna objetos datetime sin información de zona horaria adjunta, induciendo a errores de cálculo de tiempo transcurrido.

### Solución
Se refactorizaron todos los archivos del código fuente (`app/main.py`, `app/models/reporte.py`, `app/middlewares/rate_limit.py`, `app/services/reportes.py`) importando `timezone` de la biblioteca estándar de Python y reemplazando las funciones antiguas por:
`datetime.now(timezone.utc)`
Esto asegura que todos los timestamps generados se almacenen explícitamente en el huso horario estándar UTC de manera uniforme.

### Aprendizaje
Siempre se deben generar e interpretar las marcas de tiempo asociándolas a una zona horaria fija (`timezone-aware`). Esto previene ambigüedades horarias a nivel de base de datos y protege al código contra cambios disruptivos en futuras versiones del intérprete de Python.

---

## BUG-003: Condición de Carrera y Fuga de Memoria en el Middleware de Control de Frecuencia

### Síntoma
Cuando la API era sometida a pruebas de estrés o a múltiples peticiones simultáneas, el middleware de Rate Limiting fallaba permitiendo un volumen de peticiones mayor al establecido (100 por IP). Además, el uso de memoria RAM del servidor web aumentaba continuamente sin volver a su estado base, saturando los recursos del sistema operativo hasta forzar la caída del proceso (*Out of Memory*).

### Causa
1. **Memory Leak**: El middleware almacenaba el registro de llamadas en un diccionario en memoria (`self._historial_peticiones`) sin una tarea de limpieza activa o expiración para liberar IPs antiguas que ya no realizaban peticiones.
2. **Race Condition**: La lectura y el incremento de las marcas de tiempo se hacían de forma no atómica en la memoria del hilo de ejecución. Adicionalmente, al usar múltiples workers en Uvicorn, cada worker mantenía su propio diccionario local, permitiendo saltarse el límite real de peticiones al alternar entre procesos.

### Solución
Se reemplazó el diccionario local en memoria por una persistencia distribuida en **Redis**. La verificación se rediseñó bajo operaciones atómicas de Redis:
- `redis_client.incr(clave)`: Incrementa el contador de manera segura, evitando condiciones de carrera entre múltiples workers.
- `redis_client.expire(clave, 900)`: Asigna un tiempo de vida (TTL) de 15 minutos al contador únicamente en su primer registro, lo que garantiza la liberación automática de memoria RAM sin intervención manual de la aplicación.
- Se implementó resiliencia *fail-open* para dejar pasar la solicitud si el servidor de Redis está inactivo, priorizando la disponibilidad de la API.

### Aprendizaje
Los middlewares globales de control de tráfico en sistemas multi-proceso deben utilizar almacenes de datos rápidos en memoria que sean centralizados y atómicos (como Redis). Esto garantiza la consistencia del control de accesos a lo largo de toda la infraestructura distribuida y previene fugas de recursos a nivel de sistema operativo.

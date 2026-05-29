# subscriber.py
"""
Suscriptor Autónomo de Redis (Pub/Sub Pattern).
Responsabilidad: Escuchar asíncronamente eventos de infraestructura publicados
bajo el patrón "infra:*" y registrar la información en consola en tiempo real.

Este script está diseñado para correr en un proceso de sistema operativo y terminal
completamente SEPARADO de la API de FastAPI.

================================================================================
⚠️ RESTRICCIÓN TÉCNICA IMPORTANTE: Bloqueo de Conexión en Pub/Sub
================================================================================
En el protocolo de comunicación de Redis, cuando una conexión entra en modo de
suscripción (ejecutando SUBSCRIBE o PSUBSCRIBE), el canal de socket queda reservado
únicamente para recibir mensajes enviados por el servidor. 
Esta conexión queda BLOQUEADA para enviar otros comandos comunes de Redis como GET, SET,
o PUBLISH. Si intentamos realizar otra operación sobre esta misma conexión, Redis
retornará un error.

Por tanto, es obligatorio:
1. Tener un cliente de Redis con conexión dedicada y exclusiva para el suscriptor.
2. Mantener al publicador (dentro de FastAPI) con su propio pool de conexiones independiente.
"""

import os
import json
import logging
from dotenv import load_dotenv
import redis

# Configuración del formateador de logs en consola
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger("subscriber")

# 1. Cargar las variables de entorno desde el archivo .env ubicado en la raíz
# Comentario en español: En python-dotenv la carga es silenciosa por defecto (sin publicidad de dotenv v17),
# cumpliendo con el estándar de mantener los logs de producción completamente limpios (BUG-003).
load_dotenv()

# Obtener la URL de conexión segura de Upstash Redis
redis_url = os.getenv("REDIS_URL")

if not redis_url:
    logger.error("❌ Error: La variable REDIS_URL no está definida en el archivo .env.")
    exit(1)

def iniciar_suscriptor():
    """
    Inicializa la conexión dedicada y suscribe al cliente al patrón de canales 'infra:*'.
    """
    logger.info("=========================================================")
    logger.info("[Redis Sub] Iniciando suscriptor autónomo de eventos...")
    logger.info("=========================================================")

    try:
        # 2. Crear una instancia de conexión independiente dedicada exclusivamente al suscriptor
        # decode_responses=True decodifica automáticamente los payloads JSON de bytes a string UTF-8
        client = redis.Redis.from_url(redis_url, decode_responses=True)
        
        # Validar la conexión inicial con un PING
        client.ping()
        logger.info("📡 [Redis Sub] Conexión establecida con Upstash Redis exitosamente.")

        # 3. Crear el objeto Pub/Sub dedicado
        pubsub_obj = client.pubsub()

        # 4. Suscribirse por patrón utilizando el wildcard (*)
        # Esto captura simultáneamente todos los canales bajo el espacio 'study:',
        # por ejemplo: 'study:sesion:creada' y 'study:sesion:actualizada'
        patron = "study:*"
        pubsub_obj.psubscribe(patron)
        logger.info(f"🔍 [Redis Sub] Escuchando patrón '{patron}' en canales de Upstash...")
        logger.info("💡 Esperando eventos entrantes. Presiona Ctrl+C para salir.\n")

        # 5. Ciclo infinito bloqueante que escucha y procesa los mensajes entrantes
        for mensaje in pubsub_obj.listen():
            # El primer mensaje recibido tras la suscripción es una confirmación de tipo 'psubscribe',
            # la cual omitimos. Solo procesamos mensajes de tipo 'pmessage' (mensajes por patrón).
            if mensaje["type"] == "pmessage":
                canal_origen = mensaje["channel"]
                datos_raw = mensaje["data"]

                try:
                    # Deserializar la carga útil en formato JSON
                    evento = json.loads(datos_raw)
                    
                    tipo_evento = evento.get("tipo", "desconocido")
                    timestamp = evento.get("timestamp", "desconocido")
                    payload = evento.get("payload", {})

                    # Extraer detalles específicos del reporte
                    reporte_id = payload.get("id", "N/A")
                    titulo = payload.get("titulo", "Sin título")
                    ubicacion = payload.get("ubicacion", "Sin ubicación")
                    estado = payload.get("estado", "desconocido")

                    # Log visual elegante solicitado
                    print("=" * 70)
                    print(f"📢 [EVENTO RECIBIDO] Canal: {canal_origen} | Tipo: {tipo_evento} | Timestamp: {timestamp}")
                    print(f"Datos del Reporte: [ID: {reporte_id}] - {titulo} | Ubicación: {ubicacion} | Estado: {estado}")
                    print("=" * 70 + "\n")

                except json.JSONDecodeError:
                    logger.warning(f"⚠️ Recibido mensaje no deserializable en canal {canal_origen}: {datos_raw}")
                except Exception as ex:
                    logger.error(f"❌ Error al procesar el mensaje: {ex}")

    except redis.ConnectionError as err:
        logger.error(f"❌ Error de conexión en el suscriptor de Redis: {err}")
    except KeyboardInterrupt:
        logger.info("\n🛑 Suscriptor detenido por el usuario (KeyboardInterrupt).")
    except Exception as err:
        logger.error(f"❌ Ocurrió un error inesperado en el suscriptor: {err}")

if __name__ == "__main__":
    iniciar_suscriptor()

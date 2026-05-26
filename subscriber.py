# subscriber.py
"""
Suscriptor Independiente de Eventos Redis (Patrón Pub/Sub).
Responsabilidad: Escuchar eventos asíncronos en tiempo real que se publiquen
en el canal 'canal_infraestructura' de Redis.
Muestra en consola cuando un reporte es creado, modificado o eliminado.
Este proceso corre de forma separada al servidor de la API backend.
"""

import time
import json
import logging
from app.redis.client import get_redis_client
from app.core.config import settings

# Configurar logs específicos para el proceso de suscripción
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [SUSCRIPTOR] %(levelname)s: %(message)s"
)
logger = logging.getLogger(__name__)

def iniciar_suscriptor():
    """
    Se conecta a Redis, se suscribe al canal de incidencias de infraestructura
    y escucha en bucle los mensajes publicados por el servicio de reportes.
    Incluye lógica de reintento ante desconexiones.
    """
    canal_suscripcion = "canal_infraestructura"
    
    logger.info("=========================================================")
    logger.info("Iniciando el suscriptor de eventos de Infraestructura...")
    logger.info(f"URL de Redis configurada: {settings.REDIS_URL}")
    logger.info("=========================================================")
    
    intentos_conexion = 0
    
    while True:
        try:
            # Obtiene el cliente Redis configurado
            client = get_redis_client()
            
            # Crea un objeto PubSub
            pubsub = client.pubsub()
            
            # Se suscribe al canal
            pubsub.subscribe(canal_suscripcion)
            logger.info(f"Suscrito con éxito al canal: '{canal_suscripcion}'")
            logger.info("Esperando eventos de reportes... Presiona Ctrl+C para salir.")
            
            intentos_conexion = 0 # Reiniciar contador al conectar con éxito
            
            # Escucha indefinida de mensajes
            for mensaje in pubsub.listen():
                # Redis envía un mensaje inicial de tipo 'subscribe' al confirmar la conexión
                if mensaje["type"] == "subscribe":
                    logger.info(f"Confirmación de suscripción: {mensaje}")
                    continue
                
                # Cargar el contenido del mensaje (se decodifica de forma automática gracias a decode_responses=True)
                data_string = mensaje["data"]
                try:
                    evento = json.loads(data_string)
                    logger.info("---------------------------------------------------------")
                    logger.info(f"¡Evento Detectado!: {evento.get('evento')}")
                    logger.info(f"ID del Reporte: {evento.get('id')}")
                    logger.info(f"Datos completos: {json.dumps(evento, indent=2, ensure_ascii=False)}")
                    logger.info("---------------------------------------------------------")
                except json.JSONDecodeError:
                    logger.warning(f"Se recibió un mensaje con formato no JSON: {data_string}")
                    
        except (ConnectionError, Exception) as err:
            intentos_conexion += 1
            logger.error(f"Error en la conexión del suscriptor: {err}")
            logger.info(f"Reintentando conectar a Redis en 5 segundos (Intento #{intentos_conexion})...")
            time.sleep(5)

if __name__ == "__main__":
    try:
        iniciar_suscriptor()
    except KeyboardInterrupt:
        logger.info("Suscriptor detenido manualmente por el usuario.")

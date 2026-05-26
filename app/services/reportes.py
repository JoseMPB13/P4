# app/services/reportes.py
"""
Capa de Servicio (Lógica de Negocio).
Responsabilidad: Coordinar y procesar las reglas de negocio de la entidad "Reporte".
Maneja la lógica operacional independientemente de la infraestructura externa de la base de datos.

Este servicio implementa una persistencia temporal en memoria para cumplir con los
requerimientos académicos de la primera fase, encapsulando las variables privadas
dentro de la clase `ReporteService`.
"""

import json
import logging
from datetime import datetime
from typing import List, Optional

from app.models.reporte import ReporteModel
from app.schemas.reporte import ReporteCreate, ReporteUpdate
from app.redis.client import get_redis_client

# Configuración del registrador de logs de Python para esta capa
logger = logging.getLogger(__name__)

class ReporteService:
    """
    Clase de servicio que centraliza las operaciones de negocio de los Reportes.
    Implementa almacenamiento en memoria estática para simular una base de datos.
    """
    
    # === Persistencia Temporal Privada (Simulación Académica) ===
    # _reportes: Lista privada de clase para almacenar instancias de ReporteModel.
    _reportes: List[ReporteModel] = []
    
    # _next_id: Contador privado secuencial de clase para asignar IDs únicos autoincrementales.
    _next_id: int = 1

    @classmethod
    def obtener_todos(cls) -> List[ReporteModel]:
        """
        Retorna la colección completa de reportes registrados.
        """
        logger.info("Recuperando todos los reportes desde la base de datos en memoria.")
        return cls._reportes

    @classmethod
    def obtener_por_id(cls, reporte_id: int) -> Optional[ReporteModel]:
        """
        Busca y retorna un reporte específico por su ID entero.
        Si no existe, retorna None.
        """
        logger.info(f"Buscando reporte ID: {reporte_id} en memoria.")
        for reporte in cls._reportes:
            if reporte.id == reporte_id:
                return reporte
        return None

    @classmethod
    def crear(cls, datos: ReporteCreate) -> ReporteModel:
        """
        Crea una nueva entidad de Reporte, la guarda en memoria y publica un evento en Redis.
        """
        # Instanciar el modelo mapeando los campos del DTO (Pydantic schema) al modelo físico
        nuevo_reporte = ReporteModel(
            id=cls._next_id,
            titulo=datos.titulo,
            descripcion=datos.descripcion,
            tipo_problema=datos.tipo_problema,
            ubicacion=datos.ubicacion,
            imagen_url=datos.imagen_url,
            # Valores por defecto requeridos por las reglas del negocio:
            prioridad="media",      # Todo reporte inicia con prioridad media
            estado="pendiente",     # Todo reporte inicia en estado pendiente
            creado_en=datetime.utcnow() # Timestamp de creación en UTC
        )
        
        # Guardar en nuestra persistencia temporal
        cls._reportes.append(nuevo_reporte)
        
        # Incrementar el secuenciador para el siguiente registro
        cls._next_id += 1
        
        logger.info(f"Reporte ID {nuevo_reporte.id} guardado con éxito en memoria.")

        # Intentar publicar el evento en Redis (Pub/Sub) para los suscriptores activos
        try:
            redis_client = get_redis_client()
            evento = {
                "evento": "REPORTE_CREADO",
                "id": nuevo_reporte.id,
                "titulo": nuevo_reporte.titulo,
                "tipo_problema": nuevo_reporte.tipo_problema,
                "ubicacion": nuevo_reporte.ubicacion,
                "prioridad": nuevo_reporte.prioridad,
                "creado_en": nuevo_reporte.creado_en.isoformat()
            }
            redis_client.publish("canal_infraestructura", json.dumps(evento))
            logger.info("Evento de creación publicado en Redis.")
        except Exception as err:
            # Captura de errores silenciosa: Si Redis está caído en local, el sistema no se detiene.
            logger.warning(f"Error al enviar mensaje a Redis (modo académico continuado): {err}")
            
        return nuevo_reporte

    @classmethod
    def actualizar(cls, reporte_id: int, datos: ReporteUpdate) -> Optional[ReporteModel]:
        """
        Actualiza de manera parcial la prioridad o el estado de un reporte existente.
        """
        reporte = cls.obtener_por_id(reporte_id)
        if not reporte:
            logger.warning(f"Intento de actualizar reporte inexistente con ID: {reporte_id}")
            return None
            
        # Modificar campos opcionales si se proporcionaron valores en la petición
        if datos.prioridad is not None:
            reporte.prioridad = datos.prioridad
        if datos.estado is not None:
            reporte.estado = datos.estado
            
        logger.info(f"Reporte ID {reporte_id} actualizado en memoria.")

        # Notificar el cambio a Redis Pub/Sub
        try:
            redis_client = get_redis_client()
            evento = {
                "evento": "REPORTE_ACTUALIZADO",
                "id": reporte.id,
                "prioridad": reporte.prioridad,
                "estado": reporte.estado
            }
            redis_client.publish("canal_infraestructura", json.dumps(evento))
            logger.info("Evento de actualización publicado en Redis.")
        except Exception as err:
            logger.warning(f"Error al enviar actualización a Redis: {err}")
            
        return reporte

    @classmethod
    def eliminar(cls, reporte_id: int) -> bool:
        """
        Remueve un reporte por su ID de la base de datos temporal en memoria.
        Retorna True si fue eliminado, False en caso contrario.
        """
        for indice, reporte in enumerate(cls._reportes):
            if reporte.id == reporte_id:
                cls._reportes.pop(indice)
                logger.info(f"Reporte ID {reporte_id} eliminado de memoria.")
                
                # Publicar evento de eliminación en Redis Pub/Sub
                try:
                    redis_client = get_redis_client()
                    evento = {
                        "evento": "REPORTE_ELIMINADO",
                        "id": reporte_id,
                        "fecha": datetime.utcnow().isoformat()
                    }
                    redis_client.publish("canal_infraestructura", json.dumps(evento))
                    logger.info("Evento de eliminación publicado en Redis.")
                except Exception as err:
                    logger.warning(f"Error al enviar eliminación a Redis: {err}")
                return True
                
        logger.warning(f"Intento de eliminar reporte inexistente con ID: {reporte_id}")
        return False

# app/services/reportes.py
"""
Capa de Servicio (Lógica de Negocio).
Responsabilidad: Implementar las reglas de negocio de los Reportes.
Mapea las peticiones con los modelos relacionales y controla la base de datos temporal.

Esta versión integra la publicación asíncrona de eventos utilizando Redis Pub/Sub
a través de Upstash. Los eventos se publican en canales específicos cada vez que
se crea o modifica un reporte.
"""

import json
import logging
from datetime import datetime
from typing import List
from fastapi import HTTPException, status

from app.models.reporte import ReporteModel
from app.schemas.reporte import ReporteCreate, ReporteUpdate
from app.redis.client import get_redis_client

logger = logging.getLogger(__name__)

class ReporteService:
    """
    Servicio encargado del procesamiento operacional de Reportes.
    Implementa publicación de eventos estructurados sobre Redis para mensajería en tiempo real.
    """
    
    # Persistencia temporal privada
    _reportes: List[ReporteModel] = []
    _next_id: int = 1

    @classmethod
    def listar_todos(cls) -> List[ReporteModel]:
        """
        Retorna la lista de reportes registrados.
        """
        logger.info("Servicio: Listando todos los reportes.")
        return cls._reportes

    @classmethod
    def obtener_por_id(cls, id: int) -> ReporteModel:
        """
        Busca un reporte por ID y lanza HTTPException 404 si no existe.
        """
        logger.info(f"Servicio: Buscando reporte con ID: {id}.")
        for reporte in cls._reportes:
            if reporte.id == id:
                return reporte
        
        logger.warning(f"Servicio: Reporte con ID {id} no fue encontrado.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reporte {id} no encontrado"
        )

    @classmethod
    def crear(cls, reporte_en: ReporteCreate) -> ReporteModel:
        """
        Registra un reporte en memoria y publica un evento en el canal 'infra:reporte:creado'.
        """
        nuevo_reporte = ReporteModel(
            id=cls._next_id,
            titulo=reporte_en.titulo,
            descripcion=reporte_en.descripcion,
            tipo_problema=reporte_en.tipo_problema,
            ubicacion=reporte_en.ubicacion,
            imagen_url=reporte_en.imagen_url,
            prioridad="media",
            estado="pendiente",
            creado_en=datetime.utcnow()
        )
        
        # Guardar en memoria
        cls._reportes.append(nuevo_reporte)
        cls._next_id += 1
        
        logger.info(f"Servicio: Reporte creado exitosamente en memoria con ID: {nuevo_reporte.id}")

        # === PUBLICADOR DE EVENTOS ASÍNCRONOS (REDIS PUB/SUB) ===
        # Definimos el canal de destino
        canal = "infra:reporte:creado"
        
        # Estructuramos el payload del reporte a un formato serializable
        payload_datos = {
            "id": nuevo_reporte.id,
            "titulo": nuevo_reporte.titulo,
            "descripcion": nuevo_reporte.descripcion,
            "tipo_problema": nuevo_reporte.tipo_problema,
            "ubicacion": nuevo_reporte.ubicacion,
            "imagen_url": nuevo_reporte.imagen_url,
            "prioridad": nuevo_reporte.prioridad,
            "estado": nuevo_reporte.estado,
            "creado_en": nuevo_reporte.creado_en.isoformat()
        }

        # Estructuramos el sobre del evento según las Reglas de Oro de Mensajería
        mensaje = {
            "tipo": "reporte:creado",
            "payload": payload_datos,
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0"
        }

        try:
            # Obtener el cliente de Redis y publicar el JSON serializado
            redis_client = get_redis_client()
            redis_client.publish(canal, json.dumps(mensaje))
            logger.info(f"Servicio: Evento 'reporte:creado' publicado en el canal '{canal}'.")
        except Exception as err:
            # La falla de mensajería no debe abortar la transacción de negocio local (principio de resiliencia)
            logger.error(f"Servicio: No se pudo publicar el evento en Redis: {err}")
            
        return nuevo_reporte

    @classmethod
    def actualizar(cls, id: int, reporte_en: ReporteUpdate) -> ReporteModel:
        """
        Modifica un reporte y publica un evento en el canal 'infra:reporte:actualizado'.
        """
        # Buscar el reporte; si no existe, lanza 404 automáticamente
        reporte = cls.obtener_por_id(id)
        
        # Aplicar modificaciones parciales si están presentes en la petición
        if reporte_en.prioridad is not None:
            reporte.prioridad = reporte_en.prioridad
        if reporte_en.estado is not None:
            reporte.estado = reporte_en.estado
            
        logger.info(f"Servicio: Reporte ID {id} actualizado en memoria.")

        # === PUBLICADOR DE EVENTOS ASÍNCRONOS (REDIS PUB/SUB) ===
        canal = "infra:reporte:actualizado"
        
        # Mapeamos los datos actualizados a un diccionario serializable
        payload_datos = {
            "id": reporte.id,
            "titulo": reporte.titulo,
            "descripcion": reporte.descripcion,
            "tipo_problema": reporte.tipo_problema,
            "ubicacion": reporte.ubicacion,
            "imagen_url": reporte.imagen_url,
            "prioridad": reporte.prioridad,
            "estado": reporte.estado,
            "creado_en": reporte.creado_en.isoformat()
        }

        # Sobre de mensajería estructurado
        mensaje = {
            "tipo": "reporte:actualizado",
            "payload": payload_datos,
            "timestamp": datetime.utcnow().isoformat(),
            "version": "1.0.0"
        }

        try:
            redis_client = get_redis_client()
            redis_client.publish(canal, json.dumps(mensaje))
            logger.info(f"Servicio: Evento 'reporte:actualizado' publicado en el canal '{canal}'.")
        except Exception as err:
            logger.error(f"Servicio: No se pudo publicar el evento de actualización en Redis: {err}")
            
        return reporte

    @classmethod
    def eliminar(cls, id: int) -> bool:
        """
        Elimina un reporte en memoria. Si no existe, lanza 404.
        """
        # Validar existencia (lanza 404 si no existe)
        cls.obtener_por_id(id)
        
        for indice, reporte in enumerate(cls._reportes):
            if reporte.id == id:
                cls._reportes.pop(indice)
                logger.info(f"Servicio: Reporte ID {id} eliminado de memoria.")
                
                # Opcional: publicar evento de eliminación si se requiere a futuro.
                return True
                
        return False

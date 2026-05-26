# app/services/reportes.py
"""
Capa de Servicio (Lógica de Negocio).
Responsabilidad: Implementar la lógica operacional para el recurso "Reporte".
Maneja las validaciones de negocio y controla la base de datos temporal en memoria.

En esta fase, la persistencia es en memoria mediante la lista privada `_reportes`.
Si un recurso solicitado no existe, el servicio lanza un error HTTP 404 que será
capturado por el manejador global de excepciones en la entrada de la aplicación.
"""

import json
import logging
from datetime import datetime
from typing import List, Optional
from fastapi import HTTPException, status

from app.models.reporte import ReporteModel
from app.schemas.reporte import ReporteCreate, ReporteUpdate
from app.redis.client import get_redis_client

# Configuración del log para depurar operaciones
logger = logging.getLogger(__name__)

class ReporteService:
    """
    Clase que implementa los servicios de negocio de Reportes de Infraestructura.
    Almacena los registros temporalmente en una lista estática privada de la clase.
    """
    
    # Lista privada de reportes que actúa como base de datos en memoria
    _reportes: List[ReporteModel] = []
    
    # Secuenciador numérico privado autoincremental para las llaves primarias (IDs)
    _next_id: int = 1

    @classmethod
    def listar_todos(cls) -> List[ReporteModel]:
        """
        Retorna todos los reportes actualmente almacenados en memoria.
        Código de estado recomendado al responder: 200 OK (Solicitud exitosa con datos).
        """
        logger.info("Servicio: Listando todos los reportes.")
        return cls._reportes

    @classmethod
    def obtener_por_id(cls, id: int) -> ReporteModel:
        """
        Busca un reporte específico por su ID único.
        Si no se encuentra, lanza un HTTPException con código 404 (Not Found).
        
        ¿Por qué 404 Not Found?: Es el estándar HTTP para indicar que el recurso
        solicitado no existe en el servidor.
        """
        logger.info(f"Servicio: Buscando reporte con ID: {id}.")
        for reporte in cls._reportes:
            if reporte.id == id:
                return reporte
        
        # El recurso no existe, lanzamos excepción HTTP
        logger.warning(f"Servicio: Reporte con ID {id} no fue encontrado.")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reporte {id} no encontrado"
        )

    @classmethod
    def crear(cls, reporte_en: ReporteCreate) -> ReporteModel:
        """
        Crea un nuevo reporte basándose en el esquema de entrada (ReporteCreate).
        Asigna un ID único secuencial, establece la prioridad en 'media' y
        el estado en 'pendiente' por defecto, y define el timestamp de creación.
        Retorna el objeto ReporteModel creado.
        
        Código de estado recomendado al responder: 201 Created (Nuevo recurso creado con éxito).
        """
        # Instanciar el modelo ORM mapeando los datos de entrada
        nuevo_reporte = ReporteModel(
            id=cls._next_id,
            titulo=reporte_en.titulo,
            descripcion=reporte_en.descripcion,
            tipo_problema=reporte_en.tipo_problema,
            ubicacion=reporte_en.ubicacion,
            imagen_url=reporte_en.imagen_url,
            prioridad="media",          # Prioridad inicial predeterminada (Requisito Académico)
            estado="pendiente",         # Estado inicial obligatorio (Requisito Académico)
            creado_en=datetime.utcnow() # Fecha de registro en UTC
        )
        
        # Guardar en persistencia temporal
        cls._reportes.append(nuevo_reporte)
        cls._next_id += 1
        
        logger.info(f"Servicio: Reporte creado exitosamente con ID: {nuevo_reporte.id}")

        # Intentar notificar la creación en Redis Pub/Sub de manera asíncrona y segura
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
        except Exception as err:
            logger.warning(f"Servicio: No se pudo publicar en Redis (omisión académica activa): {err}")
            
        return nuevo_reporte

    @classmethod
    def actualizar(cls, id: int, reporte_en: ReporteUpdate) -> ReporteModel:
        """
        Actualiza parcialmente los campos prioridad y/o estado de un reporte por su ID.
        Si el reporte no existe, lanza un HTTPException 404 (Not Found) llamando internamente a obtener_por_id.
        Modifica únicamente los campos que no sean nulos (None) en el payload del request.
        Retorna el modelo modificado.
        
        Código de estado recomendado al responder: 200 OK (Modificación exitosa).
        """
        # Buscar el reporte; si no existe, esta línea lanza automáticamente el error 404
        reporte = cls.obtener_por_id(id)
        
        # Modificar únicamente los campos presentes en el cuerpo de la petición (Update parcial)
        if reporte_en.prioridad is not None:
            reporte.prioridad = reporte_en.prioridad
        if reporte_en.estado is not None:
            reporte.estado = reporte_en.estado
            
        logger.info(f"Servicio: Reporte ID {id} actualizado. Nuevos valores -> Prioridad: {reporte.prioridad}, Estado: {reporte.estado}")

        # Notificar la actualización a Redis Pub/Sub
        try:
            redis_client = get_redis_client()
            evento = {
                "evento": "REPORTE_ACTUALIZADO",
                "id": reporte.id,
                "prioridad": reporte.prioridad,
                "estado": reporte.estado
            }
            redis_client.publish("canal_infraestructura", json.dumps(evento))
        except Exception as err:
            logger.warning(f"Servicio: No se pudo notificar la actualización en Redis: {err}")
            
        return reporte

    @classmethod
    def eliminar(cls, id: int) -> bool:
        """
        Busca un reporte por su ID. Si no existe, lanza un HTTPException 404 (Not Found).
        Si existe, lo remueve de la lista en memoria y retorna True.
        
        Código de estado recomendado al responder: 200 OK (Operación exitosa con mensaje de confirmación).
        """
        # Validar existencia del reporte; lanza 404 si no existe
        cls.obtener_por_id(id)
        
        # Eliminar el elemento de la lista
        for indice, reporte in enumerate(cls._reportes):
            if reporte.id == id:
                cls._reportes.pop(indice)
                logger.info(f"Servicio: Reporte ID {id} removido del almacenamiento temporal.")
                
                # Notificar la eliminación en Redis Pub/Sub
                try:
                    redis_client = get_redis_client()
                    evento = {
                        "evento": "REPORTE_ELIMINADO",
                        "id": id,
                        "fecha": datetime.utcnow().isoformat()
                    }
                    redis_client.publish("canal_infraestructura", json.dumps(evento))
                except Exception as err:
                    logger.warning(f"Servicio: No se pudo notificar la eliminación en Redis: {err}")
                return True
                
        return False

# app/services/reportes.py
"""
Capa de Servicio (Lógica de Negocio).
Responsabilidad: Implementar las reglas de negocio de los Reportes de Infraestructura.
Mapea las peticiones con los modelos relacionales (SQLAlchemy) e interactúa con la
base de datos física en Supabase utilizando la sesión activa de BD.

Esta versión integra la publicación asíncrona de eventos utilizando Redis Pub/Sub
a través de Upstash. Los eventos se publican en canales específicos cada vez que
se crea o modifica un reporte en la base de datos relacional de forma exitosa.
"""

import json
import logging
from datetime import datetime, timezone
from typing import List
from fastapi import HTTPException, status
# Comentario en español: Importamos joinedload para optimizar las consultas relacionales y evitar el problema N+1.
from sqlalchemy.orm import Session, joinedload

from app.models.reporte import ReporteModel
from app.schemas.reporte import ReporteCreate, ReporteUpdate
from app.redis.client import get_redis_client

logger = logging.getLogger(__name__)

class ReporteService:
    """
    Servicio encargado del procesamiento operacional de Reportes.
    Traduce operaciones de negocio en consultas ORM a través de SQLAlchemy y maneja la
    publicación de eventos estructurados sobre Redis para mensajería en tiempo real.
    """

    @staticmethod
    def listar_todos(db: Session) -> List[ReporteModel]:
        """
        Retorna la lista de todos los reportes registrados en la base de datos relacional.
        """
        logger.info("Servicio: Listando todos los reportes desde la base de datos.")
        # Comentario en español: Usamos joinedload para traer las relaciones de usuario y técnico en un solo query (Eager Loading)
        return db.query(ReporteModel).options(
            joinedload(ReporteModel.usuario),
            joinedload(ReporteModel.tecnico)
        ).all()

    @staticmethod
    def obtener_por_id(db: Session, id: int) -> ReporteModel:
        """
        Busca un reporte por su ID único en la base de datos y lanza HTTPException 404 si no existe.
        """
        logger.info(f"Servicio: Buscando reporte con ID: {id} en la base de datos.")
        # Comentario en español: Usamos joinedload para optimizar la consulta individual del reporte con sus relaciones
        reporte = db.query(ReporteModel).options(
            joinedload(ReporteModel.usuario),
            joinedload(ReporteModel.tecnico)
        ).filter(ReporteModel.id == id).first()
        
        if not reporte:
            logger.warning(f"Servicio: Reporte con ID {id} no fue encontrado.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Reporte {id} no encontrado"
            )
        return reporte

    @staticmethod
    def crear(db: Session, reporte_en: ReporteCreate) -> ReporteModel:
        """
        Registra un reporte en la base de datos física y publica un evento en el canal 'infra:reporte:creado'.
        Usa datetime.now(timezone.utc) estándar moderno de Python para evitar la deprecación de utcnow.
        """
        # Instanciar el modelo ORM mapeado con la estructura relacional
        nuevo_reporte = ReporteModel(
            titulo=reporte_en.titulo,
            descripcion=reporte_en.descripcion,
            tipo_problema=reporte_en.tipo_problema,
            ubicacion=reporte_en.ubicacion,
            imagen_url=reporte_en.imagen_url,
            prioridad="media", # Prioridad por defecto requerida por las reglas de negocio
            estado="pendiente", # Estado inicial predeterminado
            creado_en=datetime.now(timezone.utc),
            usuario_id=reporte_en.usuario_id,
            asignado_a=reporte_en.asignado_a
        )
        
        # Persistencia relacional transaccional
        db.add(nuevo_reporte)
        db.commit()
        db.refresh(nuevo_reporte) # Recupera el ID autoincremental generado por la base de datos
        
        logger.info(f"Servicio: Reporte creado exitosamente en base de datos con ID: {nuevo_reporte.id}")

        # === PUBLICADOR DE EVENTOS ASÍNCRONOS (REDIS PUB/SUB) ===
        # Definimos el canal de destino para la mensajería asíncrona
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
            "creado_en": nuevo_reporte.creado_en.isoformat(),
            "usuario_id": nuevo_reporte.usuario_id,
            "asignado_a": nuevo_reporte.asignado_a
        }

        # Estructuramos el sobre del evento según las Reglas de Oro de Mensajería
        mensaje = {
            "tipo": "reporte:creado",
            "payload": payload_datos,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0"
        }

        try:
            # Obtener el cliente de Redis y publicar el JSON serializado
            redis_client = get_redis_client()
            redis_client.publish(canal, json.dumps(mensaje))
            logger.info(f"Servicio: Evento 'reporte:creado' publicado en el canal '{canal}'.")
        except Exception as err:
            # Resiliencia: La falla de mensajería externa no aborta la transacción principal
            logger.error(f"Servicio: No se pudo publicar el evento en Redis: {err}")
            
        return nuevo_reporte

    @staticmethod
    def actualizar(db: Session, id: int, reporte_en: ReporteUpdate) -> ReporteModel:
        """
        Modifica los campos permitidos del reporte y publica un evento en 'infra:reporte:actualizado'.
        """
        # Buscar el reporte; si no existe, lanza 404 automáticamente en obtener_por_id
        reporte = ReporteService.obtener_por_id(db, id)
        
        # Aplicar modificaciones parciales si están presentes en la petición
        if reporte_en.prioridad is not None:
            reporte.prioridad = reporte_en.prioridad
        if reporte_en.estado is not None:
            reporte.estado = reporte_en.estado
        if reporte_en.asignado_a is not None:
            reporte.asignado_a = reporte_en.asignado_a
            
        # Guardar cambios y refrescar el estado del objeto ORM
        db.commit()
        db.refresh(reporte)
        
        logger.info(f"Servicio: Reporte ID {id} actualizado en base de datos.")

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
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": "1.0.0"
        }

        try:
            redis_client = get_redis_client()
            redis_client.publish(canal, json.dumps(mensaje))
            logger.info(f"Servicio: Evento 'reporte:actualizado' publicado en el canal '{canal}'.")
        except Exception as err:
            logger.error(f"Servicio: No se pudo publicar el evento de actualización en Redis: {err}")
            
        return reporte

    @staticmethod
    def eliminar(db: Session, id: int) -> bool:
        """
        Elimina físicamente un reporte de la base de datos. Si no existe, lanza 404.
        """
        # Validar existencia (lanza 404 si no existe)
        reporte = ReporteService.obtener_por_id(db, id)
        
        db.delete(reporte)
        db.commit()
        
        logger.info(f"Servicio: Reporte ID {id} eliminado físicamente de la base de datos.")
        return True
